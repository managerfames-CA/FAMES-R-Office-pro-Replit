import type { IRepository } from '../repositories/interfaces/IRepository';
import type { AcceptanceReview, AuditRisk, AuditRiskStatus, Engagement, IndependenceAssessment, Staff } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';

export type AuditRiskInput = Omit<AuditRisk, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

const transitions: Record<AuditRiskStatus, AuditRiskStatus[]> = {
  Draft: ['Identified', 'Assessment in Progress', 'Rejected'],
  Identified: ['Assessment in Progress', 'Response Required', 'Rejected'],
  'Assessment in Progress': ['Identified', 'Response Required', 'Manager Review', 'Rejected'],
  'Response Required': ['Assessment in Progress', 'Manager Review', 'Rejected'],
  'Manager Review': ['Assessment in Progress', 'Partner Review', 'Approved', 'Rejected'],
  'Partner Review': ['Manager Review', 'Approved', 'Rejected'],
  Approved: ['Closed'], Closed: [], Rejected: ['Draft']
};

export class AuditRiskService {
  constructor(
    private readonly repository: IRepository<AuditRisk>,
    private readonly engagements: IRepository<Engagement>,
    private readonly acceptance: IRepository<AcceptanceReview>,
    private readonly independence: IRepository<IndependenceAssessment>,
    private readonly staff: IRepository<Staff>,
    private readonly activity: ActivityService
  ) {}

  canTransition(from: AuditRiskStatus, to: AuditRiskStatus): boolean { return from === to || transitions[from].includes(to); }

  async save(input: AuditRiskInput, operatorName: string, id?: string): Promise<AuditRisk> {
    await requireMutableAuditEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'audit risk change');
    const [acceptanceRecord, independenceRecord] = await Promise.all([
      this.acceptance.list().then(records => records.find(record => record.engagementId === input.engagementId && !record.isDeleted) ?? null),
      this.independence.list().then(records => records.find(record => record.engagementId === input.engagementId && !record.isDeleted) ?? null)
    ]);
    if (acceptanceRecord?.status !== 'Approved' || independenceRecord?.status !== 'Cleared') {
      const prerequisites: string[] = [];
      if (acceptanceRecord?.status !== 'Approved') prerequisites.push('Acceptance must be Approved before risks can be recorded.');
      if (independenceRecord?.status !== 'Cleared') prerequisites.push('Independence must be Cleared before risks can be recorded.');
      throw new ValidationError('Audit risk prerequisites are incomplete.', prerequisites);
    }
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Audit risk was not found.', 'NOT_FOUND');
    if (existing?.status === 'Closed') throw new ValidationError('Audit risk is read-only.', ['Closed risks cannot be changed.']);
    const errors: string[] = [];
    if (!input.riskCode.trim()) errors.push('Risk Code is required.');
    if (!input.riskTitle.trim()) errors.push('Risk Title is required.');
    if (!input.auditArea.trim()) errors.push('Audit Area is required.');
    if (input.riskType === 'Assertion Level' && input.assertions.length === 0) errors.push('At least one assertion is required for an Assertion Level risk.');
    const reviewStatuses: AuditRiskStatus[] = ['Manager Review', 'Partner Review', 'Approved', 'Closed'];
    if (reviewStatuses.includes(input.status) && !input.plannedAuditResponse.trim()) errors.push('Planned Audit Response is required before Manager Review.');
    if ((input.significantRisk || input.fraudRisk || input.riskType === 'Significant Risk' || input.riskType === 'Fraud Risk') && input.status === 'Approved' && existing?.status !== 'Partner Review') errors.push('Fraud and Significant Risks require Partner Review before approval.');
    if (existing && !this.canTransition(existing.status, input.status)) errors.push(`${existing.status} cannot transition directly to ${input.status}.`);
    if (input.preparedById && [input.managerReviewerId, input.partnerReviewerId].includes(input.preparedById)) errors.push('Reviewer cannot equal preparer.');
    const staffChecks: Array<[string, 'Manager' | 'Partner' | null, string]> = [
      [input.assignedStaffId, null, 'Assigned Staff'], [input.preparedById, null, 'Prepared By'],
      [input.managerReviewerId, 'Manager', 'Manager Reviewer'], [input.partnerReviewerId, 'Partner', 'Partner Reviewer']
    ];
    for (const [staffId, role, label] of staffChecks) {
      if (!staffId) continue;
      const member = await this.staff.getById(staffId);
      if (!member || member.isDeleted || !member.isActive) errors.push(`${label} must be active staff.`);
      else if (role && member.role !== role) errors.push(`${label} must have the ${role} role.`);
    }
    const records = await this.repository.list({ includeDeleted: true });
    if (records.some(item => item.id !== id && !item.isDeleted && item.engagementId === input.engagementId && item.riskCode.trim().toLowerCase() === input.riskCode.trim().toLowerCase())) errors.push('Risk Code must be unique within the engagement.');
    if (errors.length) throw new ValidationError('Audit risk could not be saved.', errors);
    const normalized = { ...input, riskCode: input.riskCode.trim(), riskTitle: input.riskTitle.trim(), auditArea: input.auditArea.trim(), riskDescription: input.riskDescription.trim(), plannedAuditResponse: input.plannedAuditResponse.trim(), conclusion: input.conclusion.trim(), notes: input.notes.trim(), significantRisk: input.significantRisk || input.riskType === 'Significant Risk', fraudRisk: input.fraudRisk || input.riskType === 'Fraud Risk' };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Audit Risk', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Audit Risk', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: `Risk ${saved.riskCode} created`, operatorName });
    return saved;
  }

  async get(id: string): Promise<AuditRisk | null> { return this.repository.getById(id); }
  async forEngagement(engagementId: string): Promise<AuditRisk[]> { return (await this.repository.list()).filter(item => item.engagementId === engagementId); }
  async list(includeDeleted = false): Promise<AuditRisk[]> { return this.repository.list({ includeDeleted }); }
  isSignificantOrFraud(risk: AuditRisk): boolean { return risk.significantRisk || risk.fraudRisk || risk.riskType === 'Significant Risk' || risk.riskType === 'Fraud Risk'; }
}
