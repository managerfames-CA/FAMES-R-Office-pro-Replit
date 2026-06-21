import type { IRepository } from '../repositories/interfaces/IRepository';
import type { AuditRisk, Engagement, EngagementProgramme, Staff, WorkingPaper, WorkingPaperStatus } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';

export type WorkingPaperInput = Omit<WorkingPaper, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;
const transitions: Record<WorkingPaperStatus, WorkingPaperStatus[]> = {
  Draft: ['In Preparation'], 'In Preparation': ['Draft', 'Prepared'], Prepared: ['In Preparation', 'Submitted for Review'],
  'Submitted for Review': ['Rework', 'Manager Cleared'], Rework: ['In Preparation', 'Prepared', 'Submitted for Review'],
  'Manager Cleared': ['Rework', 'Partner Cleared', 'Final'], 'Partner Cleared': ['Rework', 'Final'], Final: ['Locked'], Locked: []
};

export class WorkingPaperService {
  constructor(private readonly repository: IRepository<WorkingPaper>, private readonly programmes: IRepository<EngagementProgramme>, private readonly risks: IRepository<AuditRisk>, private readonly engagements: IRepository<Engagement>, private readonly staff: IRepository<Staff>, private readonly activity: ActivityService) {}

  async save(input: WorkingPaperInput, operatorName: string, id?: string): Promise<WorkingPaper> {
    await requireMutableAuditEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'working paper change');
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Working paper was not found.', 'NOT_FOUND');
    if (existing && ['Final', 'Locked'].includes(existing.status)) throw new ValidationError('Working paper is read-only.', ['Final or Locked working papers cannot be changed.']);
    const errors: string[] = [];
    if (!input.wpReference.trim()) errors.push('WP Reference is required.');
    if (!input.title.trim()) errors.push('Title is required.');
    if (existing && existing.status !== input.status && !transitions[existing.status].includes(input.status)) errors.push(`${existing.status} cannot transition directly to ${input.status}.`);
    const submissionStatuses: WorkingPaperStatus[] = ['Submitted for Review', 'Manager Cleared', 'Partner Cleared', 'Final', 'Locked'];
    if (submissionStatuses.includes(input.status)) {
      if (!input.objective.trim()) errors.push('Objective is required before submission.');
      if (!input.procedurePerformed.trim()) errors.push('Procedure Performed is required before submission.');
      if (!input.result.trim()) errors.push('Result is required before submission.');
      if (!input.conclusion.trim()) errors.push('Conclusion is required before submission.');
    }
    if (input.preparedDate && input.reviewDate && input.preparedDate > input.reviewDate) errors.push('Prepared Date cannot be after Review Date.');
    if (input.preparedById && input.reviewerId && input.preparedById === input.reviewerId) errors.push('Reviewer cannot equal preparer.');
    if (input.status === 'Manager Cleared') {
      if (!input.reviewerId || !input.reviewDate) errors.push('Manager Cleared status requires Manager reviewer and Review Date.');
      else { const reviewer = await this.staff.getById(input.reviewerId); if (!reviewer || reviewer.role !== 'Manager' || !reviewer.isActive || reviewer.isDeleted) errors.push('Manager Cleared status requires an active Manager reviewer.'); }
    }
    if (existing?.status === 'Submitted for Review' && input.status === 'Rework') {
      if (!input.reviewerId || !input.reviewDate) errors.push('Returning a Working Paper requires reviewer and Review Date.');
      if (!input.notes.trim()) errors.push('Returning a Working Paper requires a review comment in Notes.');
    }
    if (input.linkedProgrammeProcedureId) {
      const procedure = await this.programmes.getById(input.linkedProgrammeProcedureId);
      if (!procedure || procedure.isDeleted || procedure.engagementId !== input.engagementId) errors.push('Linked programme procedure is invalid for this engagement.');
      else if (['Final', 'Locked'].includes(input.status) && !['Completed', 'Reviewed'].includes(procedure.status)) errors.push('Final working papers require the linked programme procedure to be Completed or Reviewed.');
    } else if (['Final', 'Locked'].includes(input.status)) errors.push('Final working papers require a linked programme procedure.');
    for (const riskId of input.linkedRiskIds) {
      const risk = await this.risks.getById(riskId);
      if (!risk || risk.isDeleted || risk.engagementId !== input.engagementId) errors.push(`Linked risk ${riskId} is invalid.`);
    }
    for (const [staffId, label] of [[input.preparedById, 'Prepared By'], [input.reviewerId, 'Reviewer']] as const) {
      if (!staffId) continue;
      const member = await this.staff.getById(staffId);
      if (!member || member.isDeleted || !member.isActive) errors.push(`${label} must be active staff.`);
    }
    const all = await this.repository.list({ includeDeleted: true });
    if (all.some(item => item.id !== id && !item.isDeleted && item.engagementId === input.engagementId && item.wpReference.trim().toLowerCase() === input.wpReference.trim().toLowerCase())) errors.push('WP Reference must be unique within the engagement.');
    if (errors.length) throw new ValidationError('Working paper could not be saved.', errors);
    const normalized = { ...input, wpReference: input.wpReference.trim(), title: input.title.trim(), auditArea: input.auditArea.trim(), objective: input.objective.trim(), procedurePerformed: input.procedurePerformed.trim(), result: input.result.trim(), conclusion: input.conclusion.trim(), localPhysicalFileReference: input.localPhysicalFileReference.trim(), notes: input.notes.trim() };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Working Paper', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Working Paper', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: `Working paper ${saved.wpReference} created`, operatorName });
    return saved;
  }
  async forEngagement(engagementId: string): Promise<WorkingPaper[]> { return (await this.repository.list()).filter(item => item.engagementId === engagementId); }
  async get(id: string): Promise<WorkingPaper | null> { return this.repository.getById(id); }
  async list(includeDeleted = false): Promise<WorkingPaper[]> { return this.repository.list({ includeDeleted }); }
}
