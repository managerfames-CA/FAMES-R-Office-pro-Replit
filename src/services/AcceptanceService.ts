import type { IRepository } from '../repositories/interfaces/IRepository';
import type { AcceptanceReview, AcceptanceStatus, Engagement, Staff } from '../types/models';
import { ACCEPTANCE_TRANSITIONS } from '../constants/statuses';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';

export type AcceptanceInput = Omit<AcceptanceReview, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class AcceptanceService {
  constructor(
    private readonly repository: IRepository<AcceptanceReview>,
    private readonly engagements: IRepository<Engagement>,
    private readonly staff: IRepository<Staff>,
    private readonly activity: ActivityService
  ) {}

  canTransition(from: AcceptanceStatus, to: AcceptanceStatus): boolean {
    return from === to || ACCEPTANCE_TRANSITIONS[from].includes(to);
  }

  async save(input: AcceptanceInput, operatorName: string, id?: string): Promise<AcceptanceReview> {
    const engagement = await requireMutableAuditEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'acceptance/continuance change');
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Acceptance record was not found.', 'NOT_FOUND');
    if (existing?.status === 'Locked') throw new ValidationError('Acceptance record is read-only.', ['Locked acceptance records cannot be changed.']);
    const errors: string[] = [];
    const records = await this.repository.list({ includeDeleted: true });
    if (!id && records.some(item => !item.isDeleted && item.engagementId === input.engagementId)) errors.push('An Acceptance / Continuance record already exists for this engagement.');
    if (existing && !this.canTransition(existing.status, input.status)) errors.push(`${existing.status} cannot transition directly to ${input.status}.`);
    if (!engagement.responsibleManagerId || !engagement.responsiblePartnerId) errors.push('The Audit engagement must have a responsible Manager and Partner.');
    const manager = input.managerReviewerId ? await this.staff.getById(input.managerReviewerId) : null;
    const partner = input.partnerApproverId ? await this.staff.getById(input.partnerApproverId) : null;
    if (input.managerReviewerId && (!manager || manager.isDeleted || !manager.isActive || manager.role !== 'Manager')) errors.push('Manager reviewer must be an active Manager.');
    if (input.partnerApproverId && (!partner || partner.isDeleted || !partner.isActive || partner.role !== 'Partner')) errors.push('Partner approver must be an active Partner.');
    if (input.managerReviewerId && input.partnerApproverId && input.managerReviewerId === input.partnerApproverId) errors.push('Manager reviewer cannot be the Partner approver.');
    if (input.managerReviewerId && input.managerReviewerId !== engagement.responsibleManagerId) errors.push('Manager reviewer must be the engagement Responsible Manager.');
    if (input.partnerApproverId && input.partnerApproverId !== engagement.responsiblePartnerId) errors.push('Partner approver must be the engagement Responsible Partner.');
    if (input.status === 'Rejected' && !input.rejectionReason.trim()) errors.push('Rejection requires a reason.');
    if (input.status === 'Approved') {
      const mandatory: Array<[string, string]> = [
        [input.clientBackgroundSummary, 'Client Background Summary'], [input.natureOfBusiness, 'Nature of Business'],
        [input.managementIntegrityAssessment, 'Management Integrity Assessment'], [input.financialReportingFramework, 'Financial Reporting Framework'],
        [input.competenceResourcesAvailable, 'Competence and Resources Available'], [input.acceptanceRecommendation, 'Acceptance Recommendation'],
        [input.managerReviewerId, 'Manager Reviewer'], [input.partnerApproverId, 'Partner Approver'],
        [input.managerReviewDate, 'Manager Review Date'], [input.partnerApprovalDate, 'Partner Approval Date']
      ];
      for (const [value, label] of mandatory) if (!value.trim()) errors.push(`${label} is required for approval.`);
    }
    if (input.partnerApprovalDate && !input.managerReviewDate) errors.push('Manager Review Date is required before Partner Approval Date.');
    if (input.partnerApprovalDate && input.managerReviewDate && input.partnerApprovalDate < input.managerReviewDate) errors.push('Partner Approval Date cannot be earlier than Manager Review Date.');
    if (errors.length) throw new ValidationError('Acceptance record could not be saved.', errors);
    const normalized = {
      ...input,
      clientBackgroundSummary: input.clientBackgroundSummary.trim(), natureOfBusiness: input.natureOfBusiness.trim(),
      rejectionReason: input.rejectionReason.trim(), notes: input.notes.trim()
    };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Acceptance Review', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName, reason: saved.status === 'Rejected' ? saved.rejectionReason : '' });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Acceptance Review', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: 'Acceptance / Continuance record created', operatorName });
    return saved;
  }

  async forEngagement(engagementId: string): Promise<AcceptanceReview | null> {
    return (await this.repository.list()).find(item => item.engagementId === engagementId) ?? null;
  }
  async list(includeDeleted = false): Promise<AcceptanceReview[]> { return this.repository.list({ includeDeleted }); }
}
