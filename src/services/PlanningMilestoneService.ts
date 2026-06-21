import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Engagement, PlanningMilestone, Staff } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { isPastDue, isUpcoming } from '../utils/dates';
import { PLANNING_MILESTONE_TYPES } from '../constants/statuses';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';

export type PlanningMilestoneInput = Omit<PlanningMilestone, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class PlanningMilestoneService {
  constructor(private readonly repository: IRepository<PlanningMilestone>, private readonly engagements: IRepository<Engagement>, private readonly staff: IRepository<Staff>, private readonly activity: ActivityService) {}

  async save(input: PlanningMilestoneInput, operatorName: string, id?: string): Promise<PlanningMilestone> {
    await requireMutableAuditEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'planning milestone change');
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Planning milestone was not found.', 'NOT_FOUND');
    const errors: string[] = [];
    if (!input.milestoneType.trim()) errors.push('Milestone Type is required.');
    else if (!PLANNING_MILESTONE_TYPES.includes(input.milestoneType as (typeof PLANNING_MILESTONE_TYPES)[number])) errors.push('Milestone Type is invalid.');
    if (!input.description.trim()) errors.push('Description is required.');
    if (!input.dueDate) errors.push('Due Date is required.');
    const owner = input.ownerId ? await this.staff.getById(input.ownerId) : null;
    if (input.ownerId && (!owner || owner.isDeleted || !owner.isActive)) errors.push('Inactive or missing staff cannot own a planning milestone.');
    if (input.status === 'Completed' && !input.completionDate) errors.push('Completed milestone requires Completion Date.');
    if (existing && (existing.priority === 'Critical' || input.priority === 'Critical') && existing.dueDate !== input.dueDate && !input.changeReason.trim()) errors.push('Changing a critical milestone requires a reason.');
    const all = await this.repository.list({ includeDeleted: true });
    if (all.some(item => item.id !== id && !item.isDeleted && item.engagementId === input.engagementId && item.milestoneType === input.milestoneType)) errors.push('This milestone type already exists for the engagement.');
    if (errors.length) throw new ValidationError('Planning milestone could not be saved.', errors);
    if (existing) {
      const candidate = { ...existing, ...input, description: input.description.trim() };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Planning Milestone', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName, reason: input.changeReason });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(input.status, operatorName), ...input, description: input.description.trim() });
    await this.activity.log({ entityType: 'Planning Milestone', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: `${saved.milestoneType} milestone created`, operatorName });
    return saved;
  }

  async forEngagement(engagementId: string): Promise<PlanningMilestone[]> { return (await this.repository.list()).filter(item => item.engagementId === engagementId).sort((a,b) => a.dueDate.localeCompare(b.dueDate)); }
  isOverdue(item: PlanningMilestone): boolean { return isPastDue(item.dueDate, item.status === 'Completed' || item.status === 'Cancelled'); }
  isUpcoming(item: PlanningMilestone, days: number): boolean { return isUpcoming(item.dueDate, days, item.status === 'Completed' || item.status === 'Cancelled'); }
  async list(includeDeleted = false): Promise<PlanningMilestone[]> { return this.repository.list({ includeDeleted }); }
}
