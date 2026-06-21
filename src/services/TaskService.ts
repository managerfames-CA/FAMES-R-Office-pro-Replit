import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Client, Engagement, Staff, Task, TaskStatus } from '../types/models';
import { TASK_TRANSITIONS } from '../constants/statuses';
import { AppError, ValidationError } from '../utils/errors';
import { isPastDue } from '../utils/dates';
import { createMetadata, updateMetadata } from './helpers';
import { summarizeChanges } from '../utils/changeSummary';
import { requireMutableEngagement } from './engagementLock';
import type { ActivityService } from './ActivityService';

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class TaskService {
  constructor(private readonly repository: IRepository<Task>, private readonly clients: IRepository<Client>, private readonly engagements: IRepository<Engagement>, private readonly staff: IRepository<Staff>, private readonly activity: ActivityService) {}

  canTransition(from: TaskStatus, to: TaskStatus): boolean { return from === to || TASK_TRANSITIONS[from].includes(to); }

  private async protectEngagement(existing: Task | null, input: TaskInput, operatorName: string): Promise<void> {
    if (existing?.engagementId) await requireMutableEngagement(this.engagements, this.activity, existing.engagementId, operatorName, 'task update');
    if (input.engagementId && input.engagementId !== existing?.engagementId) await requireMutableEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'task create/update');
  }

  async save(input: TaskInput, operatorName: string, id?: string): Promise<Task> {
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Task was not found.', 'NOT_FOUND');
    await this.protectEngagement(existing, input, operatorName);
    const errors: string[] = [];
    if (!input.title.trim()) errors.push('Task title is required.');
    if (input.taskType === 'Client' && !input.clientId) errors.push('Client task requires a client.');
    if (input.taskType === 'Engagement' && !input.engagementId) errors.push('Engagement task requires an engagement.');
    if ((input.taskType === 'Client' || input.taskType === 'Engagement') && !input.dueDate) errors.push('Due date is required for client and engagement tasks.');
    if (input.clientId && !(await this.clients.getById(input.clientId))) errors.push('Selected client was not found.');
    if (input.engagementId && !(await this.engagements.getById(input.engagementId))) errors.push('Selected engagement was not found.');
    const assignee = input.assigneeId ? await this.staff.getById(input.assigneeId) : null;
    if (input.assigneeId && (!assignee || !assignee.isActive || assignee.isDeleted)) errors.push('Inactive or missing staff cannot receive new tasks.');
    const reviewer = input.reviewerId ? await this.staff.getById(input.reviewerId) : null;
    if (input.reviewerId && (!reviewer || !reviewer.isActive || reviewer.isDeleted)) errors.push('Inactive or missing staff cannot be selected as reviewer.');
    if (input.status === 'Blocked' && !input.blockerReason.trim()) errors.push('Blocked status requires a blocker reason.');
    if (input.status === 'Completed' && !input.completionDate) errors.push('Completed task requires a completion date.');
    if (!Number.isFinite(input.estimatedHours) || input.estimatedHours < 0) errors.push('Estimated hours cannot be negative.');
    if (existing && !this.canTransition(existing.status, input.status)) errors.push(`${existing.status} cannot transition directly to ${input.status}.`);
    const all = await this.repository.list({ includeDeleted: true });
    if (all.some(item => item.id !== id && !item.isDeleted && item.engagementId === input.engagementId && item.title.trim().toLocaleLowerCase() === input.title.trim().toLocaleLowerCase() && item.assigneeId === input.assigneeId && item.dueDate === input.dueDate)) errors.push('Possible duplicate task: same engagement, title, assignee and due date.');
    if (errors.length) throw new ValidationError('Task could not be saved.', errors);
    const normalized = { ...input, title: input.title.trim() };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Task', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Task', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: 'Task created', operatorName });
    return saved;
  }

  async changeStatus(id: string, status: TaskStatus, operatorName: string, details: { blockerReason?: string; completionDate?: string } = {}): Promise<Task> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new AppError('Task was not found.', 'NOT_FOUND');
    return this.save({ ...existing, status, blockerReason: details.blockerReason ?? existing.blockerReason, completionDate: details.completionDate ?? existing.completionDate }, operatorName, id);
  }

  isOverdue(task: Task): boolean { return isPastDue(task.dueDate, task.status === 'Completed' || task.status === 'Cancelled'); }
  async list(includeDeleted = false): Promise<Task[]> { return this.repository.list({ includeDeleted }); }
  async get(id: string): Promise<Task | null> { return this.repository.getById(id); }
}
