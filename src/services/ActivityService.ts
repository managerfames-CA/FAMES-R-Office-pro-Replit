import type { IRepository } from '../repositories/interfaces/IRepository';
import type { ActivityAction, AuditEvent } from '../types/models';
import { createMetadata } from './helpers';

export interface LogActivityInput {
  entityType: string;
  entityId: string;
  action: ActivityAction;
  previousStatus?: string;
  newStatus?: string;
  changedFieldSummary?: string;
  operatorName: string;
  reason?: string;
}

export class ActivityService {
  constructor(private readonly repository: IRepository<AuditEvent>) {}

  async log(input: LogActivityInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      ...createMetadata('Recorded', input.operatorName),
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      previousStatus: input.previousStatus ?? '',
      newStatus: input.newStatus ?? '',
      changedFieldSummary: input.changedFieldSummary ?? '',
      operatorName: input.operatorName,
      occurredAt: new Date().toISOString(),
      reason: input.reason ?? ''
    };
    return this.repository.create(event);
  }

  async recent(limit = 20): Promise<AuditEvent[]> {
    return (await this.repository.list()).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
  }

  async forEntity(entityType: string, entityId: string): Promise<AuditEvent[]> {
    return (await this.repository.list()).filter(event => event.entityType === entityType && event.entityId === entityId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
}
