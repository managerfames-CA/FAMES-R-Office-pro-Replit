import type { IRepository } from '../repositories/interfaces/IRepository';
import type { AuditMateriality, Engagement, MaterialityStatus, Staff } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';

export type MaterialityInput = Omit<AuditMateriality, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;
const transitions: Record<MaterialityStatus, MaterialityStatus[]> = {
  Draft: ['In Preparation', 'Manager Review'], 'In Preparation': ['Draft', 'Manager Review'],
  'Manager Review': ['In Preparation', 'Partner Review'], 'Partner Review': ['Manager Review', 'Approved'],
  Approved: ['Superseded', 'Locked'], Superseded: [], Locked: []
};

export class MaterialityService {
  constructor(private readonly repository: IRepository<AuditMateriality>, private readonly engagements: IRepository<Engagement>, private readonly staff: IRepository<Staff>, private readonly activity: ActivityService) {}

  calculate(input: MaterialityInput): MaterialityInput {
    const overallMateriality = Number((input.benchmarkAmount * input.selectedPercentage / 100).toFixed(2));
    const performanceMateriality = Number((overallMateriality * input.performanceMaterialityPercentage / 100).toFixed(2));
    const clearlyTrivialThreshold = Number((performanceMateriality * input.clearlyTrivialPercentage / 100).toFixed(2));
    return { ...input, overallMateriality, performanceMateriality, clearlyTrivialThreshold };
  }

  async save(rawInput: MaterialityInput, operatorName: string, id?: string): Promise<AuditMateriality> {
    await requireMutableAuditEngagement(this.engagements, this.activity, rawInput.engagementId, operatorName, 'materiality change');
    const snapshot = await this.repository.list({ includeDeleted: true });
    const existing = id ? snapshot.find(item => item.id === id) ?? null : null;
    if (id && !existing) throw new AppError('Materiality record was not found.', 'NOT_FOUND');
    if (existing && ['Approved', 'Superseded', 'Locked'].includes(existing.status)) throw new ValidationError('Materiality record is read-only.', ['Create a new version instead of changing an approved, superseded, or locked materiality record.']);
    const input = this.calculate(rawInput);
    const errors: string[] = [];
    if (!Number.isInteger(input.version) || input.version <= 0) errors.push('Version must be a positive integer.');
    if (!input.benchmark.trim()) errors.push('Benchmark is required.');
    if (!Number.isFinite(input.benchmarkAmount) || input.benchmarkAmount <= 0) errors.push('Benchmark Amount must be positive.');
    if (!Number.isFinite(input.selectedPercentage) || input.selectedPercentage <= 0) errors.push('Selected Percentage must be positive.');
    if (input.performanceMaterialityPercentage <= 0 || input.performanceMaterialityPercentage > 100) errors.push('Performance Materiality Percentage must be greater than 0 and no more than 100.');
    if (input.clearlyTrivialPercentage < 0 || input.clearlyTrivialPercentage > 100) errors.push('Clearly Trivial Percentage must be between 0 and 100.');
    if (input.performanceMateriality > input.overallMateriality) errors.push('Performance Materiality cannot exceed Overall Materiality.');
    if (input.clearlyTrivialThreshold > input.performanceMateriality) errors.push('Clearly Trivial Threshold cannot exceed Performance Materiality.');
    if (input.priorYearMateriality < 0) errors.push('Prior-Year Materiality cannot be negative.');
    if (input.specificMaterialityRequired && !input.specificMaterialityDetails.trim()) errors.push('Specific Materiality Details are required when specific materiality is required.');
    if (existing && existing.status !== input.status && !transitions[existing.status].includes(input.status)) errors.push(`${existing.status} cannot transition directly to ${input.status}.`);
    if (snapshot.some(item => item.id !== id && !item.isDeleted && item.engagementId === input.engagementId && item.version === input.version)) errors.push('Materiality Version must be unique within the engagement.');
    if (input.preparedById && [input.managerReviewerId, input.partnerApproverId].includes(input.preparedById)) errors.push('Reviewer or approver cannot equal preparer.');
    if (input.partnerApprovalDate && !input.managerReviewDate) errors.push('Manager Review Date is required before Partner Approval Date.');
    if (input.partnerApprovalDate && input.managerReviewDate && input.partnerApprovalDate < input.managerReviewDate) errors.push('Partner Approval Date cannot be earlier than Manager Review Date.');
    const staffChecks: Array<[string, 'Manager' | 'Partner' | null, string]> = [[input.preparedById, null, 'Prepared By'], [input.managerReviewerId, 'Manager', 'Manager Reviewer'], [input.partnerApproverId, 'Partner', 'Partner Approver']];
    for (const [staffId, role, label] of staffChecks) {
      if (!staffId) continue;
      const member = await this.staff.getById(staffId);
      if (!member || member.isDeleted || !member.isActive) errors.push(`${label} must be active staff.`);
      else if (role && member.role !== role) errors.push(`${label} must have the ${role} role.`);
    }
    if (input.status === 'Partner Review' && (!input.managerReviewerId || !input.managerReviewDate)) errors.push('Partner Review requires completed Manager review.');
    if (input.status === 'Approved') {
      if (existing && existing.status !== 'Partner Review') errors.push('Materiality must pass Partner Review before approval.');
      if (!input.managerReviewerId || !input.managerReviewDate) errors.push('Approved Materiality requires completed Manager review.');
      if (!input.partnerApproverId || !input.partnerApprovalDate) errors.push('Approved Materiality requires Partner approver and approval date.');
      if (!input.rationaleForBenchmark.trim() || !input.rationaleForPercentage.trim()) errors.push('Benchmark and percentage rationale are required for approval.');
    }
    if (errors.length) throw new ValidationError('Materiality could not be saved.', errors);
    const normalized = { ...input, benchmark: input.benchmark.trim(), rationaleForBenchmark: input.rationaleForBenchmark.trim(), rationaleForPercentage: input.rationaleForPercentage.trim(), specificMaterialityDetails: input.specificMaterialityDetails.trim(), notes: input.notes.trim() };

    if (input.status !== 'Approved') {
      if (existing) {
        const candidate = { ...existing, ...normalized };
        const summary = summarizeChanges(existing, candidate);
        if (!summary) return existing;
        const saved = await this.repository.update(updateMetadata(candidate, operatorName));
        await this.activity.log({ entityType: 'Audit Materiality', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName });
        return saved;
      }
      const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
      await this.activity.log({ entityType: 'Audit Materiality', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: `Materiality version ${saved.version} created`, operatorName });
      return saved;
    }

    const approved: AuditMateriality = existing ? updateMetadata({ ...existing, ...normalized }, operatorName) : { ...createMetadata(normalized.status, operatorName), ...normalized };
    const priorApproved = snapshot.filter(item => item.id !== approved.id && !item.isDeleted && item.engagementId === input.engagementId && item.status === 'Approved');
    const staged = snapshot.map(item => {
      if (item.id === approved.id) return approved;
      if (priorApproved.some(previous => previous.id === item.id)) return updateMetadata({ ...item, status: 'Superseded' as const }, operatorName);
      return item;
    });
    if (!existing) staged.push(approved);
    try { await this.repository.replaceAll(staged); }
    catch (error) {
      let rollbackError: unknown;
      try { await this.repository.replaceAll(snapshot); } catch (rollbackFailure) { rollbackError = rollbackFailure; }
      throw new AppError(`Materiality approval failed. ${rollbackError ? 'Automatic rollback failed.' : 'All versions were restored.'}`, 'ATOMIC_OPERATION_FAILED', [error instanceof Error ? error.message : String(error)]);
    }
    for (const previous of priorApproved) await this.activity.log({ entityType: 'Audit Materiality', entityId: previous.id, action: 'Status Change', previousStatus: 'Approved', newStatus: 'Superseded', changedFieldSummary: `Superseded by materiality version ${approved.version}`, operatorName });
    await this.activity.log({ entityType: 'Audit Materiality', entityId: approved.id, action: existing ? 'Status Change' : 'Create', previousStatus: existing?.status ?? '', newStatus: 'Approved', changedFieldSummary: `Materiality version ${approved.version} approved`, operatorName });
    return approved;
  }

  async forEngagement(engagementId: string): Promise<AuditMateriality[]> { return (await this.repository.list()).filter(item => item.engagementId === engagementId).sort((a,b) => b.version - a.version); }
  async currentApproved(engagementId: string): Promise<AuditMateriality | null> { return (await this.forEngagement(engagementId)).find(item => item.status === 'Approved') ?? null; }
  async get(id: string): Promise<AuditMateriality | null> { return this.repository.getById(id); }
  async list(includeDeleted = false): Promise<AuditMateriality[]> { return this.repository.list({ includeDeleted }); }
}
