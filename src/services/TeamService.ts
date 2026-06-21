import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Engagement, EngagementTeam, Staff } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { createMetadata, updateMetadata } from './helpers';
import { summarizeChanges } from '../utils/changeSummary';
import { requireMutableEngagement } from './engagementLock';
import type { ActivityService } from './ActivityService';

export type TeamInput = Omit<EngagementTeam, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class TeamService {
  constructor(private readonly repository: IRepository<EngagementTeam>, private readonly engagements: IRepository<Engagement>, private readonly staff: IRepository<Staff>, private readonly activity: ActivityService) {}

  async save(input: TeamInput, operatorName: string, id?: string): Promise<EngagementTeam> {
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Team assignment was not found.', 'NOT_FOUND');
    if (existing?.engagementId) await requireMutableEngagement(this.engagements, this.activity, existing.engagementId, operatorName, 'team assignment update');
    if (!existing || existing.engagementId !== input.engagementId) await requireMutableEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'team assignment create/update');
    const errors: string[] = [];
    const member = await this.staff.getById(input.staffId);
    if (!member || member.isDeleted) errors.push('Staff member was not found.');
    else if (!member.isActive && (!id || input.isActive)) errors.push('Inactive staff cannot receive new assignments.');
    if (input.assignmentRole === 'Partner' && member?.role !== 'Partner') errors.push('Partner assignment must use active Partner staff.');
    if (input.assignmentRole === 'Manager' && member?.role !== 'Manager') errors.push('Manager assignment must use active Manager staff.');
    if (!Number.isFinite(input.estimatedHours) || input.estimatedHours <= 0) errors.push('Estimated hours must be positive.');
    if (input.startDate && input.endDate && input.endDate < input.startDate) errors.push('Assignment end date cannot precede start date.');
    const all = await this.repository.list({ includeDeleted: true });
    if (all.some(item => item.id !== id && !item.isDeleted && item.isActive && item.engagementId === input.engagementId && item.staffId === input.staffId)) errors.push('This staff member already has an active assignment on the engagement.');
    if (errors.length) throw new ValidationError('Team assignment could not be saved.', errors);
    if (existing) {
      const candidate = { ...existing, ...input };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Engagement Team', entityId: saved.id, action: 'Assignment Change', changedFieldSummary: summary, operatorName });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(input.status, operatorName), ...input });
    await this.activity.log({ entityType: 'Engagement Team', entityId: saved.id, action: 'Assignment Change', changedFieldSummary: `Assigned staff ${saved.staffId} as ${saved.assignmentRole} (${saved.estimatedHours} hours)`, operatorName });
    return saved;
  }

  async deactivate(id: string, operatorName: string): Promise<EngagementTeam> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new AppError('Team assignment was not found.', 'NOT_FOUND');
    return this.save({ ...existing, isActive: false, status: 'Inactive' }, operatorName, id);
  }

  async forEngagement(engagementId: string): Promise<EngagementTeam[]> { return (await this.repository.list()).filter(item => item.engagementId === engagementId); }
  async workload(staffId: string): Promise<number> { return (await this.repository.list()).filter(item => item.staffId === staffId && item.isActive).reduce((sum, item) => sum + item.estimatedHours, 0); }
}
