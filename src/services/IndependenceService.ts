import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Engagement, IndependenceAssessment, IndependenceStatus, Staff, ThreatResponse } from '../types/models';
import { INDEPENDENCE_TRANSITIONS } from '../constants/statuses';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';

export type IndependenceInput = Omit<IndependenceAssessment, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;
const threatFields: Array<keyof Pick<IndependenceInput, 'financialInterestThreat' | 'businessRelationshipThreat' | 'familyPersonalRelationshipThreat' | 'employmentRelationshipThreat' | 'longAssociationThreat' | 'nonAuditServiceThreat' | 'feeDependencyThreat' | 'litigationThreat' | 'otherThreat'>> = ['financialInterestThreat','businessRelationshipThreat','familyPersonalRelationshipThreat','employmentRelationshipThreat','longAssociationThreat','nonAuditServiceThreat','feeDependencyThreat','litigationThreat','otherThreat'];
const responses: ThreatResponse[] = ['Yes', 'No', 'Not Applicable'];

export class IndependenceService {
  constructor(private readonly repository: IRepository<IndependenceAssessment>, private readonly engagements: IRepository<Engagement>, private readonly staff: IRepository<Staff>, private readonly activity: ActivityService) {}

  canTransition(from: IndependenceStatus, to: IndependenceStatus): boolean { return from === to || INDEPENDENCE_TRANSITIONS[from].includes(to); }

  async save(input: IndependenceInput, operatorName: string, id?: string): Promise<IndependenceAssessment> {
    await requireMutableAuditEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'independence assessment change');
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Independence assessment was not found.', 'NOT_FOUND');
    if (existing?.status === 'Locked') throw new ValidationError('Independence assessment is read-only.', ['Locked independence assessments cannot be changed.']);
    const errors: string[] = [];
    const records = await this.repository.list({ includeDeleted: true });
    if (!id && records.some(item => !item.isDeleted && item.engagementId === input.engagementId)) errors.push('An Independence assessment already exists for this engagement.');
    if (existing && !this.canTransition(existing.status, input.status)) errors.push(`${existing.status} cannot transition directly to ${input.status}.`);
    if (!input.assessmentDate) errors.push('Assessment Date is required.');
    const assessor = input.assessedById ? await this.staff.getById(input.assessedById) : null;
    if (!assessor || assessor.isDeleted || !assessor.isActive) errors.push('Assessed By must be an active staff member.');
    for (const field of threatFields) if (!responses.includes(input[field])) errors.push(`${String(field)} must be Yes, No or Not Applicable.`);
    if (!responses.includes(input.conflictFound)) errors.push('Conflict Found must be Yes, No or Not Applicable.');
    const hasThreat = threatFields.some(field => input[field] === 'Yes');
    if (hasThreat && !input.threatDescription.trim()) errors.push('Threat Description is required when any threat is Yes.');
    if (hasThreat && !input.safeguards.trim()) errors.push('Safeguards are required when any threat is Yes.');
    if (input.conflictFound === 'Yes' && (!input.safeguards.trim() || !input.conclusion.trim())) errors.push('A documented safeguard and conclusion are required to resolve a conflict.');
    if (input.status === 'Partner Clearance' && !input.managerReviewed) errors.push('Partner clearance requires Manager review.');
    if (input.status === 'Cleared') {
      if (!input.managerReviewed) errors.push('Cleared status requires Manager review.');
      if (!input.partnerCleared) errors.push('Cleared status requires Partner clearance.');
      if (!input.conclusion.trim()) errors.push('Conclusion is required before clearance.');
      if (input.conflictFound === 'Yes' && (!input.safeguards.trim() || !input.conclusion.trim())) errors.push('Unresolved conflict blocks clearance.');
    }
    if (errors.length) throw new ValidationError('Independence assessment could not be saved.', errors);
    const normalized = { ...input, threatDescription: input.threatDescription.trim(), safeguards: input.safeguards.trim(), conclusion: input.conclusion.trim(), notes: input.notes.trim() };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Independence Assessment', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Independence Assessment', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: 'Independence and conflict assessment created', operatorName });
    return saved;
  }

  async forEngagement(engagementId: string): Promise<IndependenceAssessment | null> { return (await this.repository.list()).find(item => item.engagementId === engagementId) ?? null; }
  async list(includeDeleted = false): Promise<IndependenceAssessment[]> { return this.repository.list({ includeDeleted }); }
}
