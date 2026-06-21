import type { IRepository } from '../repositories/interfaces/IRepository';
import type {
  AcceptanceReview, AuditMateriality, AuditPlanningMemo, AuditRisk, Client, Engagement, EngagementLetter, EngagementProgramme, EngagementStatus,
  EngagementTeam, IndependenceAssessment, PlanningMilestone, PlanningReadiness, Staff
} from '../types/models';
import { REQUIRED_PLANNING_MILESTONES } from '../constants/statuses';
import { isPastDue, isUpcoming } from '../utils/dates';
import type { ActivityService } from './ActivityService';

interface GateRepositories {
  clients: IRepository<Client>;
  staff: IRepository<Staff>;
  acceptanceReviews: IRepository<AcceptanceReview>;
  independenceAssessments: IRepository<IndependenceAssessment>;
  engagementLetters: IRepository<EngagementLetter>;
  auditPlans: IRepository<AuditPlanningMemo>;
  engagementTeam: IRepository<EngagementTeam>;
  planningMilestones: IRepository<PlanningMilestone>;
  auditMateriality: IRepository<AuditMateriality>;
  auditRisks: IRepository<AuditRisk>;
  engagementProgrammes: IRepository<EngagementProgramme>;
}

export class PlanningGateService {
  constructor(private readonly repositories: GateRepositories, private readonly activity: ActivityService) {}

  private async records(engagement: Engagement) {
    const [client, staff, acceptance, independence, letters, memo, team, milestones, materiality, risks, programmes] = await Promise.all([
      this.repositories.clients.getById(engagement.clientId), this.repositories.staff.list({ includeDeleted: true }),
      this.repositories.acceptanceReviews.list({ includeDeleted: true }), this.repositories.independenceAssessments.list({ includeDeleted: true }),
      this.repositories.engagementLetters.list({ includeDeleted: true }), this.repositories.auditPlans.list({ includeDeleted: true }),
      this.repositories.engagementTeam.list({ includeDeleted: true }), this.repositories.planningMilestones.list({ includeDeleted: true }),
      this.repositories.auditMateriality.list({ includeDeleted: true }), this.repositories.auditRisks.list({ includeDeleted: true }),
      this.repositories.engagementProgrammes.list({ includeDeleted: true })
    ]);
    return {
      client,
      staff,
      acceptance: acceptance.find(item => !item.isDeleted && item.engagementId === engagement.id) ?? null,
      independence: independence.find(item => !item.isDeleted && item.engagementId === engagement.id) ?? null,
      letters: letters.filter(item => !item.isDeleted && item.engagementId === engagement.id),
      memo: memo.find(item => !item.isDeleted && item.engagementId === engagement.id) ?? null,
      team: team.filter(item => !item.isDeleted && item.engagementId === engagement.id),
      milestones: milestones.filter(item => !item.isDeleted && item.engagementId === engagement.id),
      materiality: materiality.filter(item => !item.isDeleted && item.engagementId === engagement.id),
      risks: risks.filter(item => !item.isDeleted && item.engagementId === engagement.id),
      programmes: programmes.filter(item => !item.isDeleted && item.engagementId === engagement.id)
    };
  }

  async planningRequirements(engagement: Engagement): Promise<string[]> {
    const data = await this.records(engagement);
    const errors: string[] = [];
    if (engagement.serviceType !== 'Audit') return errors;
    if (!data.client || data.client.isDeleted || data.client.status !== 'Active') errors.push('Client must be Active.');
    if (!data.acceptance) errors.push('Acceptance / Continuance record is missing.');
    else if (data.acceptance.status !== 'Approved') errors.push(`Acceptance / Continuance must be Approved (current: ${data.acceptance.status}).`);
    if (!data.independence) errors.push('Independence assessment is missing.');
    else if (data.independence.status !== 'Cleared') errors.push(`Independence assessment must be Cleared (current: ${data.independence.status}).`);
    const partner = data.staff.find(item => item.id === engagement.responsiblePartnerId);
    const manager = data.staff.find(item => item.id === engagement.responsibleManagerId);
    if (!partner || partner.isDeleted || !partner.isActive || partner.role !== 'Partner') errors.push('An active Responsible Partner is required.');
    if (!manager || manager.isDeleted || !manager.isActive || manager.role !== 'Manager') errors.push('An active Responsible Manager is required.');
    if (data.acceptance?.status === 'Rejected') errors.push('Rejected Acceptance / Continuance blocks Audit Planning.');
    if (data.independence?.status === 'Rejected') errors.push('Rejected Independence assessment blocks Audit Planning.');
    return [...new Set(errors)];
  }

  async fieldworkRequirements(engagement: Engagement): Promise<string[]> {
    const data = await this.records(engagement);
    const errors = await this.planningRequirements(engagement);
    if (engagement.serviceType !== 'Audit') return errors;
    if (!data.letters.some(item => item.status === 'Accepted')) errors.push('An Accepted Engagement Letter is required.');
    if (data.memo?.status !== 'Approved') errors.push(`Planning Memorandum must be Approved${data.memo ? ` (current: ${data.memo.status})` : ''}.`);
    const activeTeam = data.team.filter(item => item.isActive);
    if (!activeTeam.some(item => item.staffId === engagement.responsiblePartnerId)) errors.push('Planning team must include the Responsible Partner.');
    if (!activeTeam.some(item => item.staffId === engagement.responsibleManagerId)) errors.push('Planning team must include the Responsible Manager.');
    const availableTypes = new Set(data.milestones.filter(item => item.status !== 'Cancelled').map(item => item.milestoneType));
    const missingMilestones = REQUIRED_PLANNING_MILESTONES.filter(type => !availableTypes.has(type));
    if (missingMilestones.length) errors.push(`Required planning milestones are missing: ${missingMilestones.join(', ')}.`);
    if (!data.materiality.some(item => item.status === 'Approved')) errors.push('Approved Materiality is required before Fieldwork.');
    if (data.risks.some(item => item.status === 'Rejected')) errors.push('Rejected Audit Risk assessments must be resolved before Fieldwork.');
    const significantRisks = data.risks.filter(item => item.significantRisk || item.fraudRisk || item.riskType === 'Significant Risk' || item.riskType === 'Fraud Risk');
    for (const risk of significantRisks) {
      if (!['Approved', 'Closed'].includes(risk.status) || !risk.plannedAuditResponse.trim()) errors.push(`Significant/Fraud Risk ${risk.riskCode} requires an approved audit response.`);
      if (!data.programmes.some(item => item.status !== 'Not Applicable' && item.linkedRiskIds.includes(risk.id))) errors.push(`Significant/Fraud Risk ${risk.riskCode} requires a linked audit programme procedure.`);
    }
    return [...new Set(errors)];
  }

  async validateTransition(engagement: Engagement, target: EngagementStatus, operatorName: string): Promise<string[]> {
    const errors = target === 'Planning' ? await this.planningRequirements(engagement) : target === 'Fieldwork' ? await this.fieldworkRequirements(engagement) : [];
    if (errors.length) {
      await this.activity.log({
        entityType: 'Engagement', entityId: engagement.id, action: 'Status Change', previousStatus: engagement.status,
        newStatus: target, changedFieldSummary: `Blocked status transition to ${target}`, operatorName, reason: errors.join(' ')
      });
    }
    return errors;
  }

  async readiness(engagement: Engagement, upcomingDays: number): Promise<PlanningReadiness> {
    const data = await this.records(engagement);
    const partner = data.staff.find(item => item.id === engagement.responsiblePartnerId);
    const manager = data.staff.find(item => item.id === engagement.responsibleManagerId);
    const activeTeam = data.team.filter(item => item.isActive);
    const availableTypes = new Set(data.milestones.filter(item => item.status !== 'Cancelled').map(item => item.milestoneType));
    const significantRisks = data.risks.filter(item => item.significantRisk || item.fraudRisk || item.riskType === 'Significant Risk' || item.riskType === 'Fraud Risk');
    const significantFraudRisksReady = significantRisks.every(risk => ['Approved', 'Closed'].includes(risk.status) && Boolean(risk.plannedAuditResponse.trim()) && data.programmes.some(item => item.status !== 'Not Applicable' && item.linkedRiskIds.includes(risk.id))) && !data.risks.some(item => item.status === 'Rejected');
    const approvedMateriality = data.materiality.find(item => item.status === 'Approved');
    const criteria = [
      { ok: data.client?.status === 'Active' && !data.client.isDeleted, message: 'Client is not Active.' },
      { ok: data.acceptance?.status === 'Approved', message: 'Acceptance / Continuance is not Approved.' },
      { ok: data.independence?.status === 'Cleared', message: 'Independence is not Cleared.' },
      { ok: Boolean(partner && partner.isActive && !partner.isDeleted && partner.role === 'Partner'), message: 'Active Responsible Partner is missing.' },
      { ok: Boolean(manager && manager.isActive && !manager.isDeleted && manager.role === 'Manager'), message: 'Active Responsible Manager is missing.' },
      { ok: data.letters.some(item => item.status === 'Accepted'), message: 'Accepted Engagement Letter is missing.' },
      { ok: data.memo?.status === 'Approved', message: 'Planning Memorandum is not Approved.' },
      { ok: activeTeam.some(item => item.staffId === engagement.responsiblePartnerId) && activeTeam.some(item => item.staffId === engagement.responsibleManagerId), message: 'Required Partner and Manager planning team is incomplete.' },
      { ok: REQUIRED_PLANNING_MILESTONES.every(type => availableTypes.has(type)), message: 'Required planning milestones are incomplete.' },
      { ok: Boolean(approvedMateriality), message: 'Approved Materiality is missing.' },
      { ok: significantFraudRisksReady, message: 'Significant/Fraud Risk responses or programme coverage are incomplete.' }
    ];
    const completedCriteria = criteria.filter(item => item.ok).length;
    const blockingItems = criteria.filter(item => !item.ok).map(item => item.message);
    return {
      percentage: Math.round((completedCriteria / criteria.length) * 100), completedCriteria, totalCriteria: criteria.length,
      blockingItems,
      acceptanceStatus: data.acceptance?.status ?? 'Not Started', independenceStatus: data.independence?.status ?? 'Not Started',
      letterStatus: data.letters.find(item => item.status === 'Accepted')?.status ?? data.letters[0]?.status ?? 'Not Started',
      planningMemoStatus: data.memo?.status ?? 'Not Started', materialityStatus: approvedMateriality?.status ?? data.materiality[0]?.status ?? 'Not Started', significantFraudRisksReady,
      teamSize: activeTeam.length, plannedHours: activeTeam.reduce((sum, item) => sum + item.estimatedHours, 0),
      upcomingMilestones: data.milestones.filter(item => isUpcoming(item.dueDate, upcomingDays, item.status === 'Completed' || item.status === 'Cancelled')).sort((a,b) => a.dueDate.localeCompare(b.dueDate)),
      overdueMilestones: data.milestones.filter(item => isPastDue(item.dueDate, item.status === 'Completed' || item.status === 'Cancelled')).sort((a,b) => a.dueDate.localeCompare(b.dueDate))
    };
  }
}
