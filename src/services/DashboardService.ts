import type { RepositoryRegistry } from '../repositories';
import type { DashboardFilters, DashboardSummary } from '../types/models';
import { REQUIRED_PLANNING_MILESTONES } from '../constants/statuses';
import { isPastDue, isUpcoming, todayIso } from '../utils/dates';

export class DashboardService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async getSummary(filters: DashboardFilters, upcomingDays: number): Promise<DashboardSummary> {
    const [clients, engagements, tasks, deadlines, staff, activity, acceptance, independence, letters, plans, team, milestones, risks, materiality, programmes, workingPapers, documentRequests, requestItems, reviewNotes, managerReviews, partnerReviews, reportVersions, reportIssues, locks, amendments, listedCompliance, regulatoryDeadlines, committeeCommunications, qualityReviews, keyAuditMatters, taxAssignments, vatAssignments, rjscAssignments, accountingAssignments, advisoryAssignments, timesheets, expenses, invoices, collections, communications, followUps] = await Promise.all([
      this.repositories.clients.list(), this.repositories.engagements.list(), this.repositories.tasks.list(),
      this.repositories.engagementDeadlines.list(), this.repositories.staff.list(), this.repositories.auditEvents.list(),
      this.repositories.acceptanceReviews.list(), this.repositories.independenceAssessments.list(), this.repositories.engagementLetters.list(),
      this.repositories.auditPlans.list(), this.repositories.engagementTeam.list(), this.repositories.planningMilestones.list(),
      this.repositories.auditRisks.list(), this.repositories.auditMateriality.list(), this.repositories.engagementProgrammes.list(),
      this.repositories.workingPapers.list(), this.repositories.documentRequests.list(), this.repositories.documentRequestItems.list(),
      this.repositories.reviewNotes.list(), this.repositories.managerReviewRecords.list(), this.repositories.partnerReviewRecords.list(), this.repositories.reportVersions.list(), this.repositories.reportIssues.list(), this.repositories.engagementLocks.list(), this.repositories.amendmentRequests.list(),
      this.repositories.listedComplianceItems.list(), this.repositories.regulatoryDeadlines.list(), this.repositories.auditCommitteeCommunications.list(), this.repositories.qualityReviews.list(), this.repositories.keyAuditMatters.list(),
      this.repositories.taxAssignments.list(), this.repositories.vatAssignments.list(), this.repositories.rjscAssignments.list(), this.repositories.accountingAssignments.list(), this.repositories.advisoryAssignments.list(),
      this.repositories.timesheets.list(), this.repositories.expenses.list(), this.repositories.invoices.list(), this.repositories.collections.list(), this.repositories.communications.list(), this.repositories.followUps.list()
    ]);
    const hasEngagementFilter = Boolean(filters.period || filters.partnerId || filters.managerId || filters.service || filters.engagementStatus);
    const hasAnyFilter = hasEngagementFilter || Boolean(filters.clientType);
    const filteredEngagements = engagements.filter(item => {
      const client = clients.find(c => c.id === item.clientId);
      return (!filters.partnerId || item.responsiblePartnerId === filters.partnerId)
        && (!filters.managerId || item.responsibleManagerId === filters.managerId)
        && (!filters.service || item.serviceType === filters.service)
        && (!filters.engagementStatus || item.status === filters.engagementStatus)
        && (!filters.clientType || client?.entityType === filters.clientType)
        && (!filters.period || item.financialPeriodEnd.startsWith(filters.period));
    });
    const engagementIds = new Set(filteredEngagements.map(item => item.id));
    const linkedClientIds = new Set(filteredEngagements.map(item => item.clientId));
    const filteredClients = clients.filter(client => (!filters.clientType || client.entityType === filters.clientType) && (!hasEngagementFilter || linkedClientIds.has(client.id)));
    const clientIds = new Set(filteredClients.map(item => item.id));
    const visibleTasks = tasks.filter(task => !hasAnyFilter || (task.engagementId ? engagementIds.has(task.engagementId) : task.clientId ? clientIds.has(task.clientId) : false));
    const visibleDeadlines = deadlines.filter(deadline => !hasAnyFilter || (deadline.engagementId ? engagementIds.has(deadline.engagementId) : deadline.clientId ? clientIds.has(deadline.clientId) : false));
    const visibleRisks = risks.filter(item => engagementIds.has(item.engagementId));
    const visibleMateriality = materiality.filter(item => engagementIds.has(item.engagementId));
    const visibleProgrammes = programmes.filter(item => engagementIds.has(item.engagementId));
    const visibleWorkingPapers = workingPapers.filter(item => engagementIds.has(item.engagementId));
    const visibleRequests = documentRequests.filter(item => engagementIds.has(item.engagementId));
    const visibleReviewNotes = reviewNotes.filter(item => engagementIds.has(item.engagementId));
    const visibleManagerReviews = managerReviews.filter(item => engagementIds.has(item.engagementId));
    const visiblePartnerReviews = partnerReviews.filter(item => engagementIds.has(item.engagementId));
    const visibleReports = reportVersions.filter(item => engagementIds.has(item.engagementId));
    const visibleIssues = reportIssues.filter(item => engagementIds.has(item.engagementId));
    const visibleLocks = locks.filter(item => engagementIds.has(item.engagementId));
    const visibleAmendments = amendments.filter(item => engagementIds.has(item.engagementId));
    const visibleListedCompliance=listedCompliance.filter(item=>engagementIds.has(item.engagementId));
    const visibleRegulatoryDeadlines=regulatoryDeadlines.filter(item=>engagementIds.has(item.engagementId));
    const visibleCommitteeCommunications=committeeCommunications.filter(item=>engagementIds.has(item.engagementId));
    const visibleQualityReviews=qualityReviews.filter(item=>engagementIds.has(item.engagementId));
    const visibleKams=keyAuditMatters.filter(item=>engagementIds.has(item.engagementId));
    const visibleTax=taxAssignments.filter(item=>engagementIds.has(item.engagementId)); const visibleVat=vatAssignments.filter(item=>engagementIds.has(item.engagementId)); const visibleRjsc=rjscAssignments.filter(item=>engagementIds.has(item.engagementId)); const visibleAccounting=accountingAssignments.filter(item=>engagementIds.has(item.engagementId)); const visibleAdvisory=advisoryAssignments.filter(item=>engagementIds.has(item.engagementId));
    const selectedStaffIds = new Set([filters.partnerId, filters.managerId].filter(Boolean));
    const visibleTimesheets=timesheets.filter(item=>!hasAnyFilter||(item.engagementId?engagementIds.has(item.engagementId):selectedStaffIds.size?selectedStaffIds.has(item.staffId):true));
    const visibleExpenses=expenses.filter(item=>!hasAnyFilter||(item.engagementId?engagementIds.has(item.engagementId):selectedStaffIds.size?selectedStaffIds.has(item.claimedById):true));
    const visibleInvoices=invoices.filter(item=>!hasAnyFilter||(item.engagementId?engagementIds.has(item.engagementId):clientIds.has(item.clientId)));
    const visibleCollections=collections.filter(item=>!hasAnyFilter||(item.engagementId?engagementIds.has(item.engagementId):clientIds.has(item.clientId)));
    const visibleCommunications=communications.filter(item=>!hasAnyFilter||(item.engagementId?engagementIds.has(item.engagementId):clientIds.has(item.clientId)));
    const visibleFollowUps=followUps.filter(item=>!hasAnyFilter||(item.engagementId?engagementIds.has(item.engagementId):clientIds.has(item.clientId)));
    const visibleRequestIds = new Set(visibleRequests.map(item => item.id));
    const visibleRequestItems = requestItems.filter(item => visibleRequestIds.has(item.requestId));
    const taskIds = new Set(visibleTasks.map(item => item.id));
    const deadlineIds = new Set(visibleDeadlines.map(item => item.id));
    const linkedEntityEngagement = new Map<string, string>();
    for (const record of [...acceptance, ...independence, ...letters, ...plans, ...team, ...milestones, ...risks, ...materiality, ...programmes, ...workingPapers, ...documentRequests, ...reviewNotes, ...managerReviews, ...partnerReviews, ...reportVersions, ...reportIssues, ...locks, ...amendments, ...listedCompliance, ...regulatoryDeadlines, ...committeeCommunications, ...qualityReviews, ...keyAuditMatters, ...taxAssignments, ...vatAssignments, ...rjscAssignments, ...accountingAssignments, ...advisoryAssignments, ...timesheets, ...expenses, ...invoices, ...collections, ...communications, ...followUps]) linkedEntityEngagement.set(record.id, record.engagementId);
    for (const item of requestItems) {
      const request = documentRequests.find(parent => parent.id === item.requestId);
      if (request) linkedEntityEngagement.set(item.id, request.engagementId);
    }
    const visibleActivity = activity.filter(event => {
      if (!hasAnyFilter) return true;
      if (event.entityType === 'Engagement') return engagementIds.has(event.entityId);
      if (event.entityType === 'Client') return clientIds.has(event.entityId);
      if (event.entityType === 'Task') return taskIds.has(event.entityId);
      if (event.entityType === 'Deadline') return deadlineIds.has(event.entityId);
      if (event.entityType === 'Staff') return selectedStaffIds.has(event.entityId);
      const linkedEngagement = linkedEntityEngagement.get(event.entityId);
      return linkedEngagement ? engagementIds.has(linkedEngagement) : false;
    });
    const engagementStatusSummary = filteredEngagements.reduce<Record<string, number>>((summary, item) => ({ ...summary, [item.status]: (summary[item.status] ?? 0) + 1 }), {});
    const clientTypeSummary = filteredClients.reduce<Record<string, number>>((summary, item) => ({ ...summary, [item.entityType || 'Unspecified']: (summary[item.entityType || 'Unspecified'] ?? 0) + 1 }), {});
    const inactiveEngagementStatuses = new Set(['Closed', 'Cancelled', 'Locked']);
    const waitingStatuses = new Set(['Acceptance Pending', 'Manager Review', 'Partner Review', 'Reporting']);
    const openTaskStatuses = new Set(['Backlog', 'Assigned', 'In Progress', 'Blocked', 'Submitted', 'Reviewed']);
    const auditEngagements = filteredEngagements.filter(item => item.serviceType === 'Audit' && !inactiveEngagementStatuses.has(item.status));
    const acceptanceFor = (id: string) => acceptance.find(item => item.engagementId === id);
    const independenceFor = (id: string) => independence.find(item => item.engagementId === id);
    const planFor = (id: string) => plans.find(item => item.engagementId === id);
    const readyForFieldwork = (engagementId: string, partnerId: string, managerId: string) => {
      const activeTeam = team.filter(item => item.engagementId === engagementId && item.isActive);
      const milestoneTypes = new Set(milestones.filter(item => item.engagementId === engagementId && item.status !== 'Cancelled').map(item => item.milestoneType));
      const engagement = engagements.find(item => item.id === engagementId);
      const engagementRisks = risks.filter(item => item.engagementId === engagementId);
      const significantRisks = engagementRisks.filter(item => item.significantRisk || item.fraudRisk || item.riskType === 'Significant Risk' || item.riskType === 'Fraud Risk');
      const riskReady = !engagementRisks.some(item => item.status === 'Rejected') && significantRisks.every(risk => ['Approved','Closed'].includes(risk.status) && Boolean(risk.plannedAuditResponse.trim()) && programmes.some(programme => programme.engagementId === engagementId && programme.status !== 'Not Applicable' && programme.linkedRiskIds.includes(risk.id)));
      return engagement?.status === 'Planning'
        && acceptanceFor(engagementId)?.status === 'Approved'
        && independenceFor(engagementId)?.status === 'Cleared'
        && letters.some(item => item.engagementId === engagementId && item.status === 'Accepted')
        && planFor(engagementId)?.status === 'Approved'
        && materiality.some(item => item.engagementId === engagementId && item.status === 'Approved')
        && riskReady
        && activeTeam.some(item => item.staffId === partnerId)
        && activeTeam.some(item => item.staffId === managerId)
        && REQUIRED_PLANNING_MILESTONES.every(type => milestoneTypes.has(type));
    };
    return {
      activeClients: filteredClients.filter(client => client.status === 'Active').length,
      listedPieClients: filteredClients.filter(client => client.isListedPie && client.status === 'Active').length,
      activeEngagements: filteredEngagements.filter(item => !inactiveEngagementStatuses.has(item.status)).length,
      engagementsAwaitingAction: filteredEngagements.filter(item => waitingStatuses.has(item.status)).length,
      openTasks: visibleTasks.filter(task => openTaskStatuses.has(task.status)).length,
      overdueTasks: visibleTasks.filter(task => isPastDue(task.dueDate, task.status === 'Completed' || task.status === 'Cancelled')).length,
      overdueDeadlines: visibleDeadlines.filter(deadline => isPastDue(deadline.dueDate, deadline.status === 'Completed' || deadline.status === 'Cancelled')).length,
      upcomingDeadlines: visibleDeadlines.filter(deadline => isUpcoming(deadline.dueDate, upcomingDays, deadline.status === 'Completed' || deadline.status === 'Cancelled')).length,
      activeStaff: filters.partnerId || filters.managerId ? staff.filter(member => member.isActive && selectedStaffIds.has(member.id)).length : staff.filter(member => member.isActive).length,
      auditPendingAcceptance: auditEngagements.filter(item => acceptanceFor(item.id)?.status !== 'Approved').length,
      independencePending: auditEngagements.filter(item => independenceFor(item.id)?.status !== 'Cleared').length,
      lettersPendingAcceptance: auditEngagements.filter(item => !letters.some(letter => letter.engagementId === item.id && letter.status === 'Accepted')).length,
      planningAwaitingManagerReview: auditEngagements.filter(item => ['Draft','In Progress','Returned'].includes(planFor(item.id)?.status ?? 'Not Started')).length,
      planningAwaitingPartnerApproval: auditEngagements.filter(item => ['Manager Review','Partner Review'].includes(planFor(item.id)?.status ?? '')).length,
      auditReadyForFieldwork: auditEngagements.filter(item => readyForFieldwork(item.id, item.responsiblePartnerId, item.responsibleManagerId)).length,
      risksAwaitingResponse: visibleRisks.filter(item => item.status === 'Response Required' || !item.plannedAuditResponse.trim()).length,
      unresolvedSignificantFraudRisks: visibleRisks.filter(item => (item.significantRisk || item.fraudRisk || item.riskType === 'Significant Risk' || item.riskType === 'Fraud Risk') && !['Approved','Closed'].includes(item.status)).length,
      materialityAwaitingApproval: auditEngagements.filter(item => !visibleMateriality.some(record => record.engagementId === item.id && record.status === 'Approved')).length,
      programmeProceduresOverdue: visibleProgrammes.filter(item => isPastDue(item.dueDate, ['Completed','Reviewed','Not Applicable'].includes(item.status))).length,
      workingPapersAwaitingReview: visibleWorkingPapers.filter(item => ['Submitted for Review','Rework'].includes(item.status)).length,
      documentRequestsOverdue: visibleRequests.filter(item => isPastDue(item.overallDueDate, ['Accepted','Waived','Closed'].includes(item.status))).length,
      documentsPendingAcceptance: visibleRequestItems.filter(item => ['Received','Under Review','Rejected','Resubmission Required'].includes(item.status)).length,
      workingPapersAwaitingManagerReview: visibleWorkingPapers.filter(item => item.status === 'Submitted for Review').length,
      openManagerReviewNotes: visibleReviewNotes.filter(item => item.reviewLevel === 'Manager' && !['Cleared','Cancelled'].includes(item.status)).length,
      openPartnerReviewNotes: visibleReviewNotes.filter(item => item.reviewLevel === 'Partner' && !['Cleared','Cancelled'].includes(item.status)).length,
      criticalHighReviewNotes: visibleReviewNotes.filter(item => ['Critical','High'].includes(item.severity) && !['Cleared','Cancelled'].includes(item.status)).length,
      engagementsAwaitingManagerCompletion: auditEngagements.filter(item => !visibleManagerReviews.some(r => r.engagementId === item.id && r.status === 'Completed')).length,
      engagementsAwaitingPartnerApproval: auditEngagements.filter(item => visibleManagerReviews.some(r => r.engagementId === item.id && r.status === 'Completed') && !visiblePartnerReviews.some(r => r.engagementId === item.id && ['Approved','Completed'].includes(r.status))).length,
      reportsAwaitingManagerReview: visibleReports.filter(item => item.status === 'Manager Review').length,
      reportsAwaitingPartnerApproval: visibleReports.filter(item => item.status === 'Partner Review').length,
      reportsReadyToIssue: visibleReports.filter(item => item.status === 'Final Approved' && item.finalVersion && !visibleIssues.some(issue => issue.finalReportVersionId === item.id && ['Issued','Reissued'].includes(issue.status))).length,
      issuedReportsAwaitingFileLock: visibleIssues.filter(item => ['Issued','Reissued'].includes(item.status) && !visibleLocks.some(lock => lock.engagementId === item.engagementId)).length,
      lockedEngagements: filteredEngagements.filter(item => item.status === 'Locked').length,
      openAmendments: visibleAmendments.filter(item => !['Rejected','Completed','Re-Locked','Cancelled'].includes(item.amendmentStatus)).length,
      listedEngagementsOverdueCompliance: new Set(visibleListedCompliance.filter(i=>i.required&&!['Completed','Not Applicable'].includes(i.status)&&isPastDue(i.dueDate)).map(i=>i.engagementId)).size,
      eqrAwaitingCompletion: visibleQualityReviews.filter(i=>!['Cleared','Not Required'].includes(i.status)).length,
      auditCommitteeCommunicationsPending: auditEngagements.filter(e=>(e.listedPieWorkflowRequired||clients.find(c=>c.id===e.clientId)?.isListedPie)&&!visibleCommitteeCommunications.some(c=>c.engagementId===e.id&&c.communicationStage==='Completion'&&['Communicated','Closed'].includes(c.status))).length,
      kamDecisionsPending: visibleKams.filter(i=>!['Approved','Not a KAM','Reported'].includes(i.status)).length,
      regulatoryDeadlinesOverdue: visibleRegulatoryDeadlines.filter(i=>isPastDue(i.dueDate,['Submitted','Completed','Waived','Cancelled'].includes(i.status))).length,
      listedReportsBlocked: auditEngagements.filter(e=>(e.listedPieWorkflowRequired||clients.find(c=>c.id===e.clientId)?.isListedPie)&&(!visibleQualityReviews.some(q=>q.engagementId===e.id&&['Cleared','Not Required'].includes(q.status))||visibleKams.some(k=>k.engagementId===e.id&&!['Approved','Not a KAM','Reported'].includes(k.status)))).length,
      taxReturnsDueSoon: visibleTax.filter(i=>isUpcoming(i.filingDeadline,upcomingDays,['Submitted','Completed','Closed','Cancelled'].includes(i.status))).length,
      taxSubmissionsOverdue: visibleTax.filter(i=>isPastDue(i.filingDeadline,['Submitted','Completed','Closed','Cancelled'].includes(i.status))).length,
      taxAssessmentsHearingsPending: visibleTax.filter(i=>i.status==='Assessment/Hearing').length,
      vatReturnsDueSoon: visibleVat.filter(i=>isUpcoming(i.filingDeadline,upcomingDays,['Submitted','Completed','Closed','Cancelled'].includes(i.status))).length,
      vatSubmissionsOverdue: visibleVat.filter(i=>isPastDue(i.filingDeadline,['Submitted','Completed','Closed','Cancelled'].includes(i.status))).length,
      vatNoticesPending: visibleVat.filter(i=>i.status==='Notice/Audit Follow-up'||Boolean(i.noticeReference&&i.noticeResponseDeadline&&!isPastDue(i.noticeResponseDeadline,false))).length,
      rjscFilingsDueSoon: visibleRjsc.filter(i=>isUpcoming(i.filingDeadline,upcomingDays,['Filed','Accepted','Completed','Closed'].includes(i.status))).length,
      rjscFilingsOverdue: visibleRjsc.filter(i=>isPastDue(i.filingDeadline,['Filed','Accepted','Completed','Closed'].includes(i.status))).length,
      accountingRecordsPending: visibleAccounting.filter(i=>i.status==='Records Pending').length,
      accountingReconciliationsPending: visibleAccounting.filter(i=>i.status==='Reconciliation'||Boolean(i.unreconciledItems.trim())).length,
      accountingAwaitingReview: visibleAccounting.filter(i=>['Internal Review','Draft Accounts','Client Review'].includes(i.status)).length,
      advisoryDeliverablesDueSoon: visibleAdvisory.filter(i=>['Draft Deliverable','Internal Review','Client Presentation'].includes(i.status)).length,
      advisoryAwaitingClientAction: visibleAdvisory.filter(i=>['Client Review','Client Presentation'].includes(i.status)).length,
      staffCurrentlyOverloaded: staff.filter(member=>member.isActive).filter(member=>{const planned=team.filter(t=>t.staffId===member.id&&t.isActive&&(!hasAnyFilter||engagementIds.has(t.engagementId))).reduce((sum,t)=>sum+t.estimatedHours,0);const open=visibleTasks.filter(t=>t.assigneeId===member.id&&openTaskStatuses.has(t.status)).reduce((sum,t)=>sum+t.estimatedHours,0);return planned+open>member.weeklyCapacityHours;}).length,
      timesheetsAwaitingReview: visibleTimesheets.filter(i=>i.status==='Submitted').length,
      expensesAwaitingApproval: visibleExpenses.filter(i=>i.status==='Submitted').length,
      invoicesAwaitingIssue: visibleInvoices.filter(i=>i.status==='Approved').length,
      overdueInvoices: visibleInvoices.filter(i=>i.outstandingAmount>0&&isPastDue(i.dueDate,false)&&!['Cancelled','Written Off'].includes(i.status)).length,
      collectionsPendingConfirmation: visibleCollections.filter(i=>i.status==='Draft').length,
      outstandingFeesByAgeing: visibleInvoices.filter(i=>i.outstandingAmount>0&&isPastDue(i.dueDate,false)).reduce((sum,i)=>sum+i.outstandingAmount,0),
      followUpsDueToday: visibleFollowUps.filter(i=>!['Completed','Cancelled'].includes(i.status)&&i.dueDate===todayIso()).length,
      overdueFollowUps: visibleFollowUps.filter(i=>!['Completed','Cancelled'].includes(i.status)&&isPastDue(i.dueDate,false)).length,
      clientCommunicationsRequiringAction: visibleCommunications.filter(i=>i.followUpRequired&&!visibleFollowUps.some(f=>f.sourceType==='Communication'&&f.sourceId===i.id&&['Completed','Cancelled'].includes(f.status))).length,
      unbilledEngagements: filteredEngagements.filter(e=>!['Cancelled'].includes(e.status)&&!visibleInvoices.some(i=>i.engagementId===e.id&&!['Cancelled'].includes(i.status))).length,
      workloadConflicts: staff.filter(member=>member.isActive).filter(member=>{const planned=team.filter(t=>t.staffId===member.id&&t.isActive&&(!hasAnyFilter||engagementIds.has(t.engagementId))).reduce((sum,t)=>sum+t.estimatedHours,0);const open=visibleTasks.filter(t=>t.assigneeId===member.id&&openTaskStatuses.has(t.status)).reduce((sum,t)=>sum+t.estimatedHours,0);return planned+open>member.weeklyCapacityHours;}).length,
      totalOutstandingFees: visibleInvoices.filter(i=>!['Cancelled','Written Off'].includes(i.status)).reduce((sum,i)=>sum+i.outstandingAmount,0),
      recentEngagements: filteredEngagements.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0,5),
      overdueTaskRecords: visibleTasks.filter(task => isPastDue(task.dueDate, task.status === 'Completed' || task.status === 'Cancelled')).sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,5),
      upcomingDeadlineRecords: visibleDeadlines.filter(deadline => isUpcoming(deadline.dueDate, upcomingDays, deadline.status === 'Completed' || deadline.status === 'Cancelled')).sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,5),
      engagementStatusSummary, clientTypeSummary,
      recentActivity: visibleActivity.sort((a,b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0,8)
    };
  }
}
