import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Client, Engagement, EngagementStatus, Staff } from '../types/models';
import { ENGAGEMENT_TRANSITIONS } from '../constants/statuses';
import { AppError, ValidationError } from '../utils/errors';
import { normalizeCode } from '../utils/normalize';
import { createMetadata, updateMetadata } from './helpers';
import { summarizeChanges } from '../utils/changeSummary';
import type { ActivityService } from './ActivityService';
import type { PlanningGateService } from './PlanningGateService';

export type EngagementInput = Omit<Engagement, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class EngagementService {
  constructor(
    private readonly repository: IRepository<Engagement>,
    private readonly clients: IRepository<Client>,
    private readonly staff: IRepository<Staff>,
    private readonly activity: ActivityService,
    private readonly planningGates?: PlanningGateService
  ) {}

  private async validate(input: EngagementInput, currentId?: string): Promise<string[]> {
    const errors: string[] = [];
    const client = await this.clients.getById(input.clientId);
    if (!client || client.isDeleted) errors.push('Selected client was not found.');
    else if (client.status !== 'Active') errors.push('Only Active clients can receive new engagements.');
    if (!input.engagementCode.trim()) errors.push('Engagement code is required.');
    if (!input.serviceType) errors.push('Service type is required.');
    if (!input.engagementType.trim()) errors.push('Engagement type is required.');
    if (input.financialPeriodStart && input.financialPeriodEnd && input.financialPeriodEnd < input.financialPeriodStart) errors.push('Financial period end cannot precede financial period start.');
    if (input.startDate && input.targetCompletionDate && input.targetCompletionDate < input.startDate) errors.push('Target completion date cannot precede start date.');
    if (input.startDate && input.reportingDeadline && input.reportingDeadline < input.startDate) errors.push('Reporting deadline cannot precede start date.');
    const allStaff = await this.staff.list();
    const partner = allStaff.find(member => member.id === input.responsiblePartnerId);
    const manager = allStaff.find(member => member.id === input.responsibleManagerId);
    if (input.serviceType === 'Audit') {
      if (!partner || !partner.isActive || partner.role !== 'Partner') errors.push('Audit engagement requires an active Partner.');
      if (!manager || !manager.isActive || manager.role !== 'Manager') errors.push('Audit engagement requires an active Manager.');
    }
    const values = [input.financial.proposedFee, input.financial.approvedFee, input.financial.budgetHours, input.financial.amountBilled, input.financial.amountCollected];
    if (values.some(value => !Number.isFinite(value) || value < 0)) errors.push('Financial values and budget hours cannot be negative.');
    if (input.financial.amountCollected > input.financial.amountBilled) errors.push('Amount collected cannot exceed amount billed.');
    const all = await this.repository.list({ includeDeleted: true });
    const code = normalizeCode(input.engagementCode);
    if (all.some(item => item.id !== currentId && normalizeCode(item.engagementCode) === code)) errors.push('Engagement code already exists.');
    const duplicate = all.some(item => item.id !== currentId && !item.isDeleted && item.clientId === input.clientId && item.serviceType === input.serviceType && item.engagementType.trim().toLocaleLowerCase() === input.engagementType.trim().toLocaleLowerCase() && item.financialPeriodStart === input.financialPeriodStart && item.financialPeriodEnd === input.financialPeriodEnd);
    if (duplicate && !input.duplicateOverrideReason?.trim()) errors.push('Possible duplicate engagement detected. Enter an override reason to continue.');
    return errors;
  }

  private prepare(input: EngagementInput, listed: boolean): EngagementInput {
    const amountBilled = Number(input.financial.amountBilled) || 0;
    const amountCollected = Number(input.financial.amountCollected) || 0;
    return {
      ...input, engagementCode: normalizeCode(input.engagementCode), engagementType: input.engagementType.trim(),
      listedPieWorkflowRequired: listed || input.listedPieWorkflowRequired, duplicateOverrideReason: input.duplicateOverrideReason?.trim(),
      financial: {
        ...input.financial, proposedFee: Number(input.financial.proposedFee) || 0, approvedFee: Number(input.financial.approvedFee) || 0,
        budgetHours: Number(input.financial.budgetHours) || 0, amountBilled, amountCollected, outstandingAmount: amountBilled - amountCollected
      }
    };
  }

  async create(input: EngagementInput, operatorName: string): Promise<Engagement> {
    const client = await this.clients.getById(input.clientId);
    const prepared = this.prepare(input, Boolean(client?.isListedPie));
    const errors = await this.validate(prepared);
    if (errors.length) throw new ValidationError('Engagement could not be created.', errors);
    const saved = await this.repository.create({ ...createMetadata(prepared.status, operatorName), ...prepared });
    await this.activity.log({ entityType: 'Engagement', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: 'Engagement created', operatorName });
    if (prepared.duplicateOverrideReason) await this.activity.log({ entityType: 'Engagement', entityId: saved.id, action: 'Duplicate Override', newStatus: saved.status, changedFieldSummary: 'Duplicate warning overridden', operatorName, reason: prepared.duplicateOverrideReason });
    return saved;
  }

  async update(id: string, input: EngagementInput, operatorName: string): Promise<Engagement> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new AppError('Engagement was not found.', 'NOT_FOUND');
    if (existing.status === 'Locked' || existing.status === 'Closed') {
      await this.activity.log({ entityType: 'Engagement', entityId: existing.id, action: 'Lock Attempt', previousStatus: existing.status, newStatus: existing.status, changedFieldSummary: 'Blocked edit attempt', operatorName, reason: 'Locked or closed engagement' });
      throw new ValidationError('Engagement cannot be edited.', [`${existing.status} engagements are read-only.`]);
    }
    if (existing.status !== input.status && !this.canTransition(existing.status, input.status)) {
      await this.activity.log({ entityType: 'Engagement', entityId: existing.id, action: 'Status Change', previousStatus: existing.status, newStatus: input.status, changedFieldSummary: `Blocked unsupported transition to ${input.status}`, operatorName, reason: `${existing.status} cannot transition directly to ${input.status}.` });
      throw new ValidationError('Unsupported status transition.', [`${existing.status} cannot transition directly to ${input.status}.`]);
    }
    const client = await this.clients.getById(input.clientId);
    const prepared = this.prepare(input, Boolean(client?.isListedPie));
    if (existing.status !== prepared.status && prepared.serviceType === 'Audit' && this.planningGates) {
      const gateContext: Engagement = { ...existing, ...prepared, status: existing.status };
      const gateErrors = await this.planningGates.validateTransition(gateContext, prepared.status, operatorName);
      if (gateErrors.length) throw new ValidationError(`Audit engagement cannot move to ${prepared.status}.`, gateErrors);
    }
    const errors = await this.validate(prepared, id);
    if (errors.length) throw new ValidationError('Engagement could not be updated.', errors);
    const candidate = { ...existing, ...prepared };
    const summary = summarizeChanges(existing, candidate);
    if (!summary) return existing;
    const saved = await this.repository.update(updateMetadata(candidate, operatorName));
    await this.activity.log({ entityType: 'Engagement', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName });
    return saved;
  }

  async updateFinancial(id: string, financial: Engagement['financial'], operatorName: string): Promise<Engagement> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new AppError('Engagement was not found.', 'NOT_FOUND');
    return this.update(id, { ...existing, financial }, operatorName);
  }

  canTransition(from: EngagementStatus, to: EngagementStatus): boolean { return from === to || ENGAGEMENT_TRANSITIONS[from].includes(to); }
  async list(includeDeleted = false): Promise<Engagement[]> { return this.repository.list({ includeDeleted }); }
  async get(id: string): Promise<Engagement | null> { return this.repository.getById(id); }
}
