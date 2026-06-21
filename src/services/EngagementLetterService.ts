import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Engagement, EngagementLetter, EngagementLetterStatus } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';

export type EngagementLetterInput = Omit<EngagementLetter, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;
const transitions: Record<EngagementLetterStatus, EngagementLetterStatus[]> = {
  Draft: ['Internal Review', 'Sent to Client', 'Rejected'], 'Internal Review': ['Draft', 'Sent to Client', 'Rejected'],
  'Sent to Client': ['Client Review', 'Accepted', 'Rejected'], 'Client Review': ['Sent to Client', 'Accepted', 'Rejected'],
  Accepted: ['Superseded', 'Expired'], Rejected: ['Draft'], Expired: ['Superseded'], Superseded: []
};

export class EngagementLetterService {
  constructor(private readonly repository: IRepository<EngagementLetter>, private readonly engagements: IRepository<Engagement>, private readonly activity: ActivityService) {}

  async save(input: EngagementLetterInput, operatorName: string, id?: string): Promise<EngagementLetter> {
    await requireMutableAuditEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'engagement letter change');
    const snapshot = await this.repository.list({ includeDeleted: true });
    const existing = id ? snapshot.find(item => item.id === id) ?? null : null;
    if (id && !existing) throw new AppError('Engagement letter was not found.', 'NOT_FOUND');
    const errors: string[] = [];
    if (!input.letterReference.trim()) errors.push('Letter Reference is required.');
    if (!Number.isInteger(input.letterVersion) || input.letterVersion <= 0) errors.push('Letter Version must be a positive integer.');
    if (existing && existing.status !== input.status && !transitions[existing.status].includes(input.status)) errors.push(`${existing.status} cannot transition directly to ${input.status}.`);
    if (input.sentToClientDate && input.draftDate && input.sentToClientDate < input.draftDate) errors.push('Sent to Client Date cannot precede Draft Date.');
    if (input.clientAcceptanceDate && input.sentToClientDate && input.clientAcceptanceDate < input.sentToClientDate) errors.push('Client Acceptance Date cannot precede Sent to Client Date.');
    if (input.expiryDate && input.effectiveDate && input.expiryDate < input.effectiveDate) errors.push('Expiry Date cannot precede Effective Date.');
    if (input.status === 'Accepted') {
      if (!input.clientAcceptanceDate) errors.push('Accepted status requires Client Acceptance Date.');
      if (!input.signedByFirm || !input.signedByClient) errors.push('Accepted status requires firm and client signature confirmation.');
    }
    if (snapshot.some(item => item.id !== id && !item.isDeleted && item.engagementId === input.engagementId && item.letterReference.trim().toLowerCase() === input.letterReference.trim().toLowerCase())) errors.push('Letter Reference must be unique within the engagement.');
    if (errors.length) throw new ValidationError('Engagement letter could not be saved.', errors);

    const normalized = { ...input, letterReference: input.letterReference.trim(), fileReference: input.fileReference.trim(), notes: input.notes.trim() };
    if (input.status !== 'Accepted') {
      if (existing) {
        const candidate = { ...existing, ...normalized };
        const summary = summarizeChanges(existing, candidate);
        if (!summary) return existing;
        const saved = await this.repository.update(updateMetadata(candidate, operatorName));
        await this.activity.log({ entityType: 'Engagement Letter', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName });
        return saved;
      }
      const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
      await this.activity.log({ entityType: 'Engagement Letter', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: `Engagement letter ${saved.letterReference} created`, operatorName });
      return saved;
    }

    // Accepting and superseding are staged and committed with one repository write.
    const acceptedRecord: EngagementLetter = existing
      ? updateMetadata({ ...existing, ...normalized }, operatorName)
      : { ...createMetadata(normalized.status, operatorName), ...normalized };
    const previousAccepted = snapshot.filter(item => item.id !== acceptedRecord.id && !item.isDeleted && item.engagementId === input.engagementId && item.status === 'Accepted');
    const staged = snapshot.map(item => {
      if (item.id === acceptedRecord.id) return acceptedRecord;
      if (previousAccepted.some(previous => previous.id === item.id)) return updateMetadata({ ...item, status: 'Superseded' as const }, operatorName);
      return item;
    });
    if (!existing) staged.push(acceptedRecord);

    try {
      await this.repository.replaceAll(staged);
    } catch (error) {
      let rollbackError: unknown;
      try { await this.repository.replaceAll(snapshot); } catch (rollbackFailure) { rollbackError = rollbackFailure; }
      const detail = rollbackError ? ' The automatic rollback also failed; restore from the pre-operation data backup.' : ' All letter records were restored to their original state.';
      throw new AppError(`Engagement Letter acceptance failed.${detail}`, 'ATOMIC_OPERATION_FAILED', [error instanceof Error ? error.message : String(error), rollbackError instanceof Error ? rollbackError.message : '']);
    }

    // Activity is deliberately written only after the atomic data operation succeeds.
    for (const previous of previousAccepted) {
      await this.activity.log({ entityType: 'Engagement Letter', entityId: previous.id, action: 'Status Change', previousStatus: 'Accepted', newStatus: 'Superseded', changedFieldSummary: `Superseded by ${acceptedRecord.letterReference}`, operatorName });
    }
    await this.activity.log({
      entityType: 'Engagement Letter', entityId: acceptedRecord.id,
      action: existing ? 'Status Change' : 'Create', previousStatus: existing?.status ?? '', newStatus: 'Accepted',
      changedFieldSummary: existing ? summarizeChanges(existing, acceptedRecord) || `Engagement letter ${acceptedRecord.letterReference} accepted` : `Engagement letter ${acceptedRecord.letterReference} created and accepted`, operatorName
    });
    return acceptedRecord;
  }

  async forEngagement(engagementId: string): Promise<EngagementLetter[]> { return (await this.repository.list()).filter(item => item.engagementId === engagementId).sort((a,b) => b.letterVersion - a.letterVersion); }
  async currentAccepted(engagementId: string): Promise<EngagementLetter | null> { return (await this.forEngagement(engagementId)).find(item => item.status === 'Accepted') ?? null; }
  async list(includeDeleted = false): Promise<EngagementLetter[]> { return this.repository.list({ includeDeleted }); }
}
