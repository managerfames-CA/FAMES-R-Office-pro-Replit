import type { IRepository } from '../repositories/interfaces/IRepository';
import type { EngagementProgramme, ProgrammeTemplate } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';

export type ProgrammeTemplateInput = Omit<ProgrammeTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class ProgrammeTemplateService {
  constructor(private readonly repository: IRepository<ProgrammeTemplate>, private readonly engagementProgrammes: IRepository<EngagementProgramme>, private readonly activity: ActivityService) {}

  async save(input: ProgrammeTemplateInput, operatorName: string, id?: string): Promise<ProgrammeTemplate> {
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Programme template was not found.', 'NOT_FOUND');
    const errors: string[] = [];
    if (!input.templateCode.trim()) errors.push('Template Code is required.');
    if (!input.templateName.trim()) errors.push('Template Name is required.');
    if (!input.procedureCode.trim()) errors.push('Procedure Code is required.');
    if (!input.procedureDescription.trim()) errors.push('Procedure Description is required.');
    if (!Number.isInteger(input.version) || input.version <= 0) errors.push('Version must be a positive integer.');
    const all = await this.repository.list({ includeDeleted: true });
    if (all.some(item => item.id !== id && !item.isDeleted && item.templateCode.trim().toLowerCase() === input.templateCode.trim().toLowerCase() && item.version === input.version)) errors.push('Template Code and Version must be unique.');
    if (all.some(item => item.id !== id && !item.isDeleted && item.procedureCode.trim().toLowerCase() === input.procedureCode.trim().toLowerCase() && item.version === input.version)) errors.push('Procedure Code and Version must be unique.');
    if (errors.length) throw new ValidationError('Programme template could not be saved.', errors);
    const normalized = { ...input, templateCode: input.templateCode.trim(), templateName: input.templateName.trim(), procedureCode: input.procedureCode.trim(), procedureDescription: input.procedureDescription.trim(), objective: input.objective.trim(), auditArea: input.auditArea.trim(), notes: input.notes.trim(), status: input.isActive ? 'Active' : 'Inactive' };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Programme Template', entityId: saved.id, action: 'Update', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Programme Template', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: `Programme template ${saved.templateCode} created`, operatorName });
    return saved;
  }

  async archive(id: string, operatorName: string): Promise<ProgrammeTemplate> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new AppError('Programme template was not found.', 'NOT_FOUND');
    if ((await this.engagementProgrammes.list({ includeDeleted: true })).some(item => item.templateId === id)) throw new ValidationError('Programme template cannot be deleted.', ['Referenced templates must remain available. Mark the template inactive instead.']);
    const saved = await this.repository.archive(id, operatorName);
    await this.activity.log({ entityType: 'Programme Template', entityId: id, action: 'Archive', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: `Template ${existing.templateCode} archived`, operatorName });
    return saved;
  }
  async list(includeDeleted = false): Promise<ProgrammeTemplate[]> { return this.repository.list({ includeDeleted }); }
  async get(id: string): Promise<ProgrammeTemplate | null> { return this.repository.getById(id); }
}
