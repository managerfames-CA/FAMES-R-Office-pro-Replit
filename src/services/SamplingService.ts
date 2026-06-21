import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Engagement, SamplingRecord, Staff, WorkingPaper } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';

export type SamplingInput = Omit<SamplingRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class SamplingService {
  constructor(private readonly repository: IRepository<SamplingRecord>, private readonly workingPapers: IRepository<WorkingPaper>, private readonly engagements: IRepository<Engagement>, private readonly staff: IRepository<Staff>, private readonly activity: ActivityService) {}
  async save(input: SamplingInput, operatorName: string, id?: string): Promise<SamplingRecord> {
    await requireMutableAuditEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'sampling register change');
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Sampling record was not found.', 'NOT_FOUND');
    const errors: string[] = [];
    if (!input.workingPaperId) errors.push('Working Paper is required.');
    else {
      const wp = await this.workingPapers.getById(input.workingPaperId);
      if (!wp || wp.isDeleted || wp.engagementId !== input.engagementId) errors.push('Working Paper is invalid for this engagement.');
    }
    if (!input.population.trim()) errors.push('Population is required.');
    if (!Number.isInteger(input.populationSize) || input.populationSize <= 0) errors.push('Population Size must be a positive integer.');
    if (!Number.isInteger(input.sampleSize) || input.sampleSize <= 0) errors.push('Sample Size must be a positive integer.');
    if (input.sampleSize > input.populationSize) errors.push('Sample Size cannot exceed Population Size.');
    if (!Number.isInteger(input.exceptionsFound) || input.exceptionsFound < 0 || input.exceptionsFound > input.sampleSize) errors.push('Exceptions Found must be between 0 and Sample Size.');
    if (input.preparedById && input.reviewerId && input.preparedById === input.reviewerId) errors.push('Reviewer cannot equal preparer.');
    for (const [staffId, label] of [[input.preparedById, 'Prepared By'], [input.reviewerId, 'Reviewer']] as const) {
      if (!staffId) continue;
      const member = await this.staff.getById(staffId);
      if (!member || member.isDeleted || !member.isActive) errors.push(`${label} must be active staff.`);
    }
    if (errors.length) throw new ValidationError('Sampling record could not be saved.', errors);
    const normalized = { ...input, population: input.population.trim(), samplingMethod: input.samplingMethod.trim(), selectionBasis: input.selectionBasis.trim(), conclusion: input.conclusion.trim(), notes: input.notes.trim() };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Sampling', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Sampling', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: `Sampling record created for ${saved.population}`, operatorName });
    return saved;
  }
  async forEngagement(engagementId: string): Promise<SamplingRecord[]> { return (await this.repository.list()).filter(item => item.engagementId === engagementId); }
  async get(id: string): Promise<SamplingRecord | null> { return this.repository.getById(id); }
  async list(includeDeleted = false): Promise<SamplingRecord[]> { return this.repository.list({ includeDeleted }); }
}
