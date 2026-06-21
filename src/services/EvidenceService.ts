import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Engagement, EvidenceRecord, EvidenceStatus, Staff, WorkingPaper } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';

export type EvidenceInput = Omit<EvidenceRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;
const transitions: Record<EvidenceStatus, EvidenceStatus[]> = {
  Requested: ['Received', 'Rejected'], Received: ['Under Review', 'Rejected'], 'Under Review': ['Accepted', 'Rejected', 'Received'],
  Accepted: ['Superseded'], Rejected: ['Received'], Superseded: []
};

export class EvidenceService {
  constructor(private readonly repository: IRepository<EvidenceRecord>, private readonly workingPapers: IRepository<WorkingPaper>, private readonly engagements: IRepository<Engagement>, private readonly staff: IRepository<Staff>, private readonly activity: ActivityService) {}

  async save(input: EvidenceInput, operatorName: string, id?: string): Promise<EvidenceRecord> {
    await requireMutableAuditEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'evidence register change');
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Evidence record was not found.', 'NOT_FOUND');
    const errors: string[] = [];
    if (!input.evidenceReference.trim()) errors.push('Evidence Reference is required.');
    if (!input.description.trim()) errors.push('Description is required.');
    if (!Number.isInteger(input.version) || input.version <= 0) errors.push('Version must be a positive integer.');
    if (existing && existing.status !== input.status && !transitions[existing.status].includes(input.status)) errors.push(`${existing.status} cannot transition directly to ${input.status}.`);
    if (input.status === 'Accepted') {
      if (!input.workingPaperId) errors.push('Evidence must link to a Working Paper before acceptance.');
      if (!input.acceptedById || !input.acceptanceDate) errors.push('Accepted evidence requires Accepted By and Acceptance Date.');
    }
    if (input.status === 'Rejected' && !input.rejectionReason.trim()) errors.push('Rejected evidence requires a reason.');
    if (input.workingPaperId) {
      const wp = await this.workingPapers.getById(input.workingPaperId);
      if (!wp || wp.isDeleted || wp.engagementId !== input.engagementId) errors.push('Linked Working Paper is invalid for this engagement.');
    }
    if (input.acceptedById) {
      const member = await this.staff.getById(input.acceptedById);
      if (!member || member.isDeleted || !member.isActive) errors.push('Accepted By must be active staff.');
    }
    const all = await this.repository.list({ includeDeleted: true });
    if (all.some(item => item.id !== id && !item.isDeleted && item.engagementId === input.engagementId && item.evidenceReference.trim().toLowerCase() === input.evidenceReference.trim().toLowerCase())) errors.push('Evidence Reference must be unique within the engagement.');
    if (errors.length) throw new ValidationError('Evidence record could not be saved.', errors);
    const normalized = { ...input, evidenceReference: input.evidenceReference.trim(), description: input.description.trim(), source: input.source.trim(), fileName: input.fileName.trim(), localPhysicalFileReference: input.localPhysicalFileReference.trim(), rejectionReason: input.rejectionReason.trim(), notes: input.notes.trim() };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Evidence', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName, reason: saved.status === 'Rejected' ? saved.rejectionReason : '' });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Evidence', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: `Evidence ${saved.evidenceReference} created`, operatorName });
    return saved;
  }
  async forEngagement(engagementId: string): Promise<EvidenceRecord[]> { return (await this.repository.list()).filter(item => item.engagementId === engagementId); }
  async get(id: string): Promise<EvidenceRecord | null> { return this.repository.getById(id); }
  async list(includeDeleted = false): Promise<EvidenceRecord[]> { return this.repository.list({ includeDeleted }); }
}
