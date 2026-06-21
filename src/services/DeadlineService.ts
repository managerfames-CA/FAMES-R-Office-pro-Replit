import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Client, Engagement, EngagementDeadline, Staff } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { isPastDue, isUpcoming } from '../utils/dates';
import { createMetadata, updateMetadata } from './helpers';
import { summarizeChanges } from '../utils/changeSummary';
import { requireMutableEngagement } from './engagementLock';
import type { ActivityService } from './ActivityService';

export type DeadlineInput = Omit<EngagementDeadline, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class DeadlineService {
  constructor(private readonly repository: IRepository<EngagementDeadline>, private readonly clients: IRepository<Client>, private readonly engagements: IRepository<Engagement>, private readonly staff: IRepository<Staff>, private readonly activity: ActivityService) {}

  async save(input: DeadlineInput, operatorName: string, id?: string): Promise<EngagementDeadline> {
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Deadline was not found.', 'NOT_FOUND');
    if (existing?.engagementId) await requireMutableEngagement(this.engagements, this.activity, existing.engagementId, operatorName, 'deadline update');
    if (input.engagementId && input.engagementId !== existing?.engagementId) await requireMutableEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'deadline create/update');
    const errors: string[] = [];
    if (!input.description.trim()) errors.push('Description is required.');
    if (!input.deadlineType.trim()) errors.push('Deadline type is required.');
    if (!input.dueDate) errors.push('Due date is required.');
    if (input.clientId && !(await this.clients.getById(input.clientId))) errors.push('Selected client was not found.');
    if (input.engagementId && !(await this.engagements.getById(input.engagementId))) errors.push('Selected engagement was not found.');
    const owner = input.ownerId ? await this.staff.getById(input.ownerId) : null;
    if (input.ownerId && (!owner || !owner.isActive || owner.isDeleted)) errors.push('Inactive or missing staff cannot own new deadlines.');
    if (input.status === 'Completed' && !input.completionDate) errors.push('Completed deadline requires a completion date.');
    if (existing?.priority === 'Critical' && existing.dueDate !== input.dueDate && !input.changeReason.trim()) errors.push('Changing a critical deadline due date requires a reason.');
    if (errors.length) throw new ValidationError('Deadline could not be saved.', errors);
    const normalized = { ...input, description: input.description.trim() };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Deadline', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName, reason: input.changeReason });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(input.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Deadline', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: 'Deadline created', operatorName });
    return saved;
  }

  async complete(id: string, completionDate: string, operatorName: string): Promise<EngagementDeadline> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new AppError('Deadline was not found.', 'NOT_FOUND');
    return this.save({ ...existing, status: 'Completed', completionDate }, operatorName, id);
  }
  isOverdue(deadline: EngagementDeadline): boolean { return isPastDue(deadline.dueDate, deadline.status === 'Completed' || deadline.status === 'Cancelled'); }
  isUpcoming(deadline: EngagementDeadline, days: number): boolean { return isUpcoming(deadline.dueDate, days, deadline.status === 'Completed' || deadline.status === 'Cancelled'); }
  async list(includeDeleted = false): Promise<EngagementDeadline[]> { return this.repository.list({ includeDeleted }); }
  async get(id: string): Promise<EngagementDeadline | null> { return this.repository.getById(id); }
}
