import type { IRepository } from '../repositories/interfaces/IRepository';
import type { AuditRisk, Engagement, EngagementProgramme, ProgrammeProcedureStatus, ProgrammeTemplate, Staff } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';

export type EngagementProgrammeInput = Omit<EngagementProgramme, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;
const transitions: Record<ProgrammeProcedureStatus, ProgrammeProcedureStatus[]> = {
  'Not Started': ['Assigned', 'In Progress', 'Not Applicable'], Assigned: ['Not Started', 'In Progress', 'Not Applicable'],
  'In Progress': ['Assigned', 'Completed', 'Not Applicable'], Completed: ['In Progress', 'Review Pending'],
  'Not Applicable': ['Not Started'], 'Review Pending': ['In Progress', 'Reviewed', 'Returned'], Reviewed: ['Returned'], Returned: ['In Progress', 'Review Pending']
};

export class AuditProgrammeService {
  constructor(private readonly repository: IRepository<EngagementProgramme>, private readonly templates: IRepository<ProgrammeTemplate>, private readonly risks: IRepository<AuditRisk>, private readonly engagements: IRepository<Engagement>, private readonly staff: IRepository<Staff>, private readonly activity: ActivityService) {}

  async createFromTemplate(engagementId: string, templateId: string, operatorName: string): Promise<EngagementProgramme> {
    const template = await this.templates.getById(templateId);
    if (!template || template.isDeleted || !template.isActive) throw new ValidationError('Programme could not be created.', ['An active programme template is required.']);
    return this.save({ engagementId, templateId, programmeArea: template.auditArea, procedureCode: template.procedureCode, objective: template.objective, procedureDescription: template.procedureDescription, linkedRiskIds: [], assertionCoverage: [], mandatory: template.mandatory, assigneeId: '', reviewerId: '', dueDate: '', status: 'Not Started', notApplicableReason: '', completionComment: '', managerReviewComment: '', notes: '' }, operatorName);
  }

  async save(input: EngagementProgrammeInput, operatorName: string, id?: string): Promise<EngagementProgramme> {
    await requireMutableAuditEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'audit programme change');
    const existing = id ? await this.repository.getById(id) : null;
    if (id && !existing) throw new AppError('Audit programme procedure was not found.', 'NOT_FOUND');
    const errors: string[] = [];
    if (!input.procedureCode.trim()) errors.push('Procedure Code is required.');
    if (!input.procedureDescription.trim()) errors.push('Procedure Description is required.');
    if (existing && existing.status !== input.status && !transitions[existing.status].includes(input.status)) errors.push(`${existing.status} cannot transition directly to ${input.status}.`);
    if (input.status === 'Not Applicable' && input.mandatory && !input.notApplicableReason.trim()) errors.push('Mandatory procedures require a reason before they can be marked Not Applicable.');
    if (input.status === 'Completed' && !input.completionComment.trim()) errors.push('Completed procedures require a completion comment.');
    if (['Review Pending', 'Reviewed'].includes(input.status) && input.assigneeId && input.reviewerId && input.assigneeId === input.reviewerId) errors.push('Reviewer must be different from the assignee.');
    const all = await this.repository.list({ includeDeleted: true });
    if (all.some(item => item.id !== id && !item.isDeleted && item.engagementId === input.engagementId && item.procedureCode.trim().toLowerCase() === input.procedureCode.trim().toLowerCase())) errors.push('Procedure Code must be unique within the engagement.');
    for (const riskId of input.linkedRiskIds) {
      const risk = await this.risks.getById(riskId);
      if (!risk || risk.isDeleted || risk.engagementId !== input.engagementId) errors.push(`Linked risk ${riskId} is invalid for this engagement.`);
    }
    for (const [staffId, label] of [[input.assigneeId, 'Assignee'], [input.reviewerId, 'Reviewer']] as const) {
      if (!staffId) continue;
      const member = await this.staff.getById(staffId);
      if (!member || member.isDeleted || !member.isActive) errors.push(`${label} must be active staff.`);
    }
    if (errors.length) throw new ValidationError('Audit programme procedure could not be saved.', errors);
    const normalized = { ...input, procedureCode: input.procedureCode.trim(), programmeArea: input.programmeArea.trim(), objective: input.objective.trim(), procedureDescription: input.procedureDescription.trim(), notApplicableReason: input.notApplicableReason.trim(), completionComment: input.completionComment.trim(), managerReviewComment: input.managerReviewComment.trim(), notes: input.notes.trim() };
    if (existing) {
      if (existing.mandatory && !normalized.mandatory) throw new ValidationError('Mandatory procedure cannot be changed.', ['A mandatory procedure cannot be converted to optional after creation.']);
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Audit Programme', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Audit Programme', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: `Procedure ${saved.procedureCode} created`, operatorName });
    return saved;
  }

  async coverageErrors(engagementId: string): Promise<string[]> {
    const [risks, procedures] = await Promise.all([this.risks.list(), this.repository.list()]);
    const engagementRisks = risks.filter(risk => risk.engagementId === engagementId && (risk.significantRisk || risk.fraudRisk || risk.riskType === 'Significant Risk' || risk.riskType === 'Fraud Risk') && risk.status !== 'Rejected' && risk.status !== 'Closed');
    const engagementProcedures = procedures.filter(item => item.engagementId === engagementId && item.status !== 'Not Applicable');
    return engagementRisks.filter(risk => !engagementProcedures.some(procedure => procedure.linkedRiskIds.includes(risk.id))).map(risk => `Significant/Fraud Risk ${risk.riskCode} must be linked to at least one audit programme procedure.`);
  }
  async forEngagement(engagementId: string): Promise<EngagementProgramme[]> { return (await this.repository.list()).filter(item => item.engagementId === engagementId); }
  async get(id: string): Promise<EngagementProgramme | null> { return this.repository.getById(id); }
  async list(includeDeleted = false): Promise<EngagementProgramme[]> { return this.repository.list({ includeDeleted }); }
}
