import type { IRepository } from '../repositories/interfaces/IRepository';
import type { AcceptanceReview, AuditPlanningMemo, Engagement, EngagementLetter, IndependenceAssessment, PlanningMemoStatus, Staff } from '../types/models';
import { PLANNING_MEMO_TRANSITIONS } from '../constants/statuses';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';

export type PlanningMemoInput = Omit<AuditPlanningMemo, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class PlanningMemoService {
  constructor(
    private readonly repository: IRepository<AuditPlanningMemo>, private readonly engagements: IRepository<Engagement>,
    private readonly acceptance: IRepository<AcceptanceReview>, private readonly independence: IRepository<IndependenceAssessment>,
    private readonly letters: IRepository<EngagementLetter>, private readonly staff: IRepository<Staff>, private readonly activity: ActivityService
  ) {}

  canTransition(from: PlanningMemoStatus, to: PlanningMemoStatus): boolean { return from === to || PLANNING_MEMO_TRANSITIONS[from].includes(to); }

  private async prerequisiteErrors(engagementId: string, finalApproval: boolean): Promise<string[]> {
    const errors: string[] = [];
    const acceptance = (await this.acceptance.list()).find(item => item.engagementId === engagementId);
    const independence = (await this.independence.list()).find(item => item.engagementId === engagementId);
    if (acceptance?.status !== 'Approved') errors.push('Acceptance / Continuance must be Approved before planning memorandum work.');
    if (independence?.status !== 'Cleared') errors.push('Independence assessment must be Cleared before planning memorandum work.');
    if (finalApproval && !(await this.letters.list()).some(item => item.engagementId === engagementId && item.status === 'Accepted')) errors.push('An Accepted Engagement Letter is required before final Planning approval.');
    return errors;
  }

  async save(input: PlanningMemoInput, operatorName: string, id?: string): Promise<AuditPlanningMemo> {
    const engagement = await requireMutableAuditEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'planning memorandum change');
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Planning memorandum was not found.', 'NOT_FOUND');
    if (existing?.status === 'Locked') throw new ValidationError('Planning memorandum is read-only.', ['Locked planning memoranda cannot be changed.']);
    if (existing?.status === 'Approved' && input.status !== 'Locked') throw new ValidationError('Approved planning is read-only.', ['Use controlled reopen with a documented reason.']);
    const errors = await this.prerequisiteErrors(input.engagementId, input.status === 'Approved');
    const records = await this.repository.list({ includeDeleted: true });
    if (!id && records.some(item => !item.isDeleted && item.engagementId === input.engagementId)) errors.push('A Planning Memorandum already exists for this engagement.');
    if (existing && !this.canTransition(existing.status, input.status)) errors.push(`${existing.status} cannot transition directly to ${input.status}.`);
    const manager = input.managerReviewerId ? await this.staff.getById(input.managerReviewerId) : null;
    const partner = input.partnerApproverId ? await this.staff.getById(input.partnerApproverId) : null;
    if (input.managerReviewerId && (!manager || !manager.isActive || manager.isDeleted || manager.role !== 'Manager')) errors.push('Manager reviewer must be an active Manager.');
    if (input.partnerApproverId && (!partner || !partner.isActive || partner.isDeleted || partner.role !== 'Partner')) errors.push('Partner approver must be an active Partner.');
    if (input.managerReviewerId && input.partnerApproverId && input.managerReviewerId === input.partnerApproverId) errors.push('Manager reviewer cannot equal Partner approver.');
    if (input.managerReviewerId && input.managerReviewerId !== engagement.responsibleManagerId) errors.push('Manager reviewer must be the engagement Responsible Manager.');
    if (input.partnerApproverId && input.partnerApproverId !== engagement.responsiblePartnerId) errors.push('Partner approver must be the engagement Responsible Partner.');
    if (input.status === 'Partner Review' && (!input.managerReviewerId || !input.managerReviewDate)) errors.push('Partner review requires completed Manager review.');
    if (input.status === 'Approved') {
      if (!input.managerReviewerId || !input.managerReviewDate) errors.push('Partner approval requires completed Manager review.');
      if (!input.partnerApproverId || !input.partnerApprovalDate) errors.push('Approved planning requires Partner approver and approval date.');
      if (!input.plannedAuditApproach.trim()) errors.push('Planned Audit Approach is required for approval.');
      if (!input.entityUnderstanding.trim()) errors.push('Entity Understanding is required for approval.');
    }
    if (input.status === 'Returned' && !input.notes.trim()) errors.push('Returned status requires review comments in Notes.');
    if (input.partnerApprovalDate && !input.managerReviewDate) errors.push('Manager Review Date is required before Partner Approval Date.');
    if (input.partnerApprovalDate && input.managerReviewDate && input.partnerApprovalDate < input.managerReviewDate) errors.push('Partner Approval Date cannot be earlier than Manager Review Date.');
    if (errors.length) throw new ValidationError('Planning memorandum could not be saved.', errors);
    const normalized = { ...input, notes: input.notes.trim() };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Audit Planning Memo', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName, reason: saved.status === 'Returned' ? saved.notes : '' });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Audit Planning Memo', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: 'Audit Planning Memorandum created', operatorName });
    return saved;
  }

  async reopen(id: string, reason: string, operatorName: string): Promise<AuditPlanningMemo> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new AppError('Planning memorandum was not found.', 'NOT_FOUND');
    await requireMutableAuditEngagement(this.engagements, this.activity, existing.engagementId, operatorName, 'planning memorandum reopen');
    if (existing.status !== 'Approved') throw new ValidationError('Planning memorandum cannot be reopened.', ['Only Approved planning memoranda may be reopened.']);
    if (!reason.trim()) throw new ValidationError('Planning memorandum cannot be reopened.', ['A reopen reason is required.']);
    const saved = await this.repository.update(updateMetadata({ ...existing, status: 'Returned', notes: reason.trim() }, operatorName));
    await this.activity.log({ entityType: 'Audit Planning Memo', entityId: saved.id, action: 'Status Change', previousStatus: 'Approved', newStatus: 'Returned', changedFieldSummary: 'Approved planning reopened through controlled action', operatorName, reason: reason.trim() });
    return saved;
  }

  async forEngagement(engagementId: string): Promise<AuditPlanningMemo | null> { return (await this.repository.list()).find(item => item.engagementId === engagementId) ?? null; }
  async list(includeDeleted = false): Promise<AuditPlanningMemo[]> { return this.repository.list({ includeDeleted }); }
}
