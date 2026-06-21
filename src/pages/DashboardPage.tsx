import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { services } from '../services';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAppContext } from '../components/AppContext';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatCard, StatusBadge } from '../components/ui';
import type { DashboardFilters } from '../types/models';
import { ENGAGEMENT_STATUSES, SERVICE_TYPES } from '../constants/statuses';
import { formatDate, formatDateTime } from '../utils/dates';

const emptyFilters: DashboardFilters = { period: '', partnerId: '', managerId: '', service: '', clientType: '', engagementStatus: '' };
function DashboardGroup({title,description,children}:{title:string;description:string;children:ReactNode}){return <section className="panel dashboard-group"><div className="panel-header"><div><h2>{title}</h2><p>{description}</p></div></div><div className="stats-grid compact">{children}</div></section>}

export function DashboardPage() {
  const { revision } = useAppContext(); const [filters, setFilters] = useState(emptyFilters);
  const related = useAsyncData(async () => { const [staff, clients] = await Promise.all([services.staff.list(), services.clients.list()]); return { staff, clients }; }, [revision]);
  const summary = useAsyncData(async () => services.dashboard.getSummary(filters, services.settings.get().upcomingDeadlineDays), [revision, JSON.stringify(filters)]);
  const partners = related.data?.staff.filter(member => member.role === 'Partner' && member.isActive) ?? [];
  const managers = related.data?.staff.filter(member => member.role === 'Manager' && member.isActive) ?? [];
  const clientTypes = useMemo(() => [...new Set((related.data?.clients ?? []).map(client => client.entityType).filter(Boolean))], [related.data]);
  const filtered=Object.values(filters).some(Boolean);

  return <>
    <PageHeader title="Dashboard" description="Firm-wide operations, audit progress, Listed/PIE, service delivery and finance from one repository-consistent view." actions={<Link className="button secondary" to="/administration/data-integrity">Data Integrity</Link>}/>
    <section className="filter-panel" aria-label="Dashboard filters">
      <label>Period<input value={filters.period} onChange={event => setFilters({ ...filters, period: event.target.value })} placeholder="YYYY" /></label>
      <label>Partner<select value={filters.partnerId} onChange={event => setFilters({ ...filters, partnerId: event.target.value })}><option value="">All</option>{partners.map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
      <label>Manager<select value={filters.managerId} onChange={event => setFilters({ ...filters, managerId: event.target.value })}><option value="">All</option>{managers.map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
      <label>Service<select value={filters.service} onChange={event => setFilters({ ...filters, service: event.target.value })}><option value="">All</option>{SERVICE_TYPES.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Client Type<select value={filters.clientType} onChange={event => setFilters({ ...filters, clientType: event.target.value })}><option value="">All</option>{clientTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Engagement Status<select value={filters.engagementStatus} onChange={event => setFilters({ ...filters, engagementStatus: event.target.value })}><option value="">All</option>{ENGAGEMENT_STATUSES.map(item => <option key={item}>{item}</option>)}</select></label>
      <button className="button secondary" disabled={!filtered} onClick={() => setFilters(emptyFilters)}>Reset</button>
    </section>
    {filtered&&<div className="alert info"><strong>Filtered view</strong><span>All related engagement, client, task, deadline, audit, service, finance and activity values use the same filter scope. Active Staff remains firm-wide and is labelled accordingly.</span></div>}
    <h2 className="sr-only">Listed/PIE and Service Workflows</h2>
    {summary.loading && <LoadingState />}{summary.error && <ErrorState message={summary.error} onRetry={summary.reload} />}
    {summary.data && <>
      <DashboardGroup title="Core Operations" description="Current client, engagement, task and deadline workload.">
        <StatCard label="Total Active Clients" value={summary.data.activeClients}/><StatCard label="Active Engagements" value={summary.data.activeEngagements}/><StatCard label="Engagements Awaiting Action" value={summary.data.engagementsAwaitingAction}/><StatCard label="Open Tasks" value={summary.data.openTasks}/><StatCard label="Overdue Tasks" value={summary.data.overdueTasks}/><StatCard label="Overdue Deadlines" value={summary.data.overdueDeadlines}/><StatCard label="Upcoming Deadlines" value={summary.data.upcomingDeadlines} detail={`${services.settings.get().upcomingDeadlineDays}-day window`}/><StatCard label="Active Staff (firm-wide)" value={summary.data.activeStaff}/>
      </DashboardGroup>
      <DashboardGroup title="Audit Progress" description="Acceptance through final report issue and file lock.">
        <StatCard label="Pending Acceptance" value={summary.data.auditPendingAcceptance}/><StatCard label="Independence Pending" value={summary.data.independencePending}/><StatCard label="Risks Awaiting Response" value={summary.data.risksAwaitingResponse}/><StatCard label="Materiality Awaiting Approval" value={summary.data.materialityAwaitingApproval}/><StatCard label="Programme Overdue" value={summary.data.programmeProceduresOverdue}/><StatCard label="Working Papers Awaiting Review" value={summary.data.workingPapersAwaitingManagerReview}/><StatCard label="Critical/High Review Notes" value={summary.data.criticalHighReviewNotes}/><StatCard label="Reports Awaiting Approval" value={summary.data.reportsAwaitingManagerReview+summary.data.reportsAwaitingPartnerApproval}/><StatCard label="Reports Ready to Issue" value={summary.data.reportsReadyToIssue}/><StatCard label="Locked Engagements" value={summary.data.lockedEngagements}/>
      </DashboardGroup>
      <DashboardGroup title="Listed / PIE" description="Additional quality-review, regulatory and communication gates for Listed/PIE audits only.">
        <StatCard label="Listed Clients" value={summary.data.listedPieClients}/><StatCard label="Compliance Overdue" value={summary.data.listedEngagementsOverdueCompliance}/><StatCard label="EQR awaiting completion" value={summary.data.eqrAwaitingCompletion}/><StatCard label="KAM Decisions Pending" value={summary.data.kamDecisionsPending}/><StatCard label="Audit Committee Completion Pending" value={summary.data.auditCommitteeCommunicationsPending}/><StatCard label="Regulatory Deadlines Overdue" value={summary.data.regulatoryDeadlinesOverdue}/><StatCard label="Listed Reports Blocked" value={summary.data.listedReportsBlocked}/>
      </DashboardGroup>
      <DashboardGroup title="Service Operations" description="Tax, VAT, RJSC, Accounting and Advisory delivery status.">
        <StatCard label="Tax Due Soon" value={summary.data.taxReturnsDueSoon}/><StatCard label="Tax Overdue" value={summary.data.taxSubmissionsOverdue}/><StatCard label="VAT Due Soon" value={summary.data.vatReturnsDueSoon}/><StatCard label="VAT Overdue" value={summary.data.vatSubmissionsOverdue}/><StatCard label="RJSC Due Soon" value={summary.data.rjscFilingsDueSoon}/><StatCard label="RJSC Overdue" value={summary.data.rjscFilingsOverdue}/><StatCard label="Accounting Pending Review" value={summary.data.accountingAwaitingReview}/><StatCard label="Advisory Deliverables Due" value={summary.data.advisoryDeliverablesDueSoon}/><StatCard label="Advisory awaiting client action" value={summary.data.advisoryAwaitingClientAction}/>
      </DashboardGroup>
      <DashboardGroup title="Practice Management and Finance" description="Workload, time, expenses, billing, collections and client follow-up.">
        <StatCard label="Workload Conflicts" value={summary.data.workloadConflicts}/><StatCard label="Timesheets awaiting review" value={summary.data.timesheetsAwaitingReview}/><StatCard label="Expenses Awaiting Approval" value={summary.data.expensesAwaitingApproval}/><StatCard label="Invoices Awaiting Issue" value={summary.data.invoicesAwaitingIssue}/><StatCard label="Overdue Invoices" value={summary.data.overdueInvoices}/><StatCard label="Total Outstanding Fees" value={summary.data.totalOutstandingFees.toLocaleString()}/><StatCard label="Collections Pending" value={summary.data.collectionsPendingConfirmation}/><StatCard label="Follow-ups Due Today" value={summary.data.followUpsDueToday}/><StatCard label="Overdue Follow-ups" value={summary.data.overdueFollowUps}/><StatCard label="Communications Requiring Action" value={summary.data.clientCommunicationsRequiringAction}/><StatCard label="Unbilled Engagements" value={summary.data.unbilledEngagements}/>
      </DashboardGroup>
      <section className="dashboard-grid">
        <article className="panel"><h2>Recent Engagements</h2>{summary.data.recentEngagements.length ? <div className="list-stack">{summary.data.recentEngagements.map(item => <Link className="list-row" to={`/engagements/${item.id}`} key={item.id}><div><strong>{item.engagementCode}</strong><span>{item.serviceType} · {item.engagementType}</span></div><StatusBadge value={item.status} /></Link>)}</div> : <EmptyState title="No engagements" description="Create an engagement to populate this section." />}</article>
        <article className="panel"><h2>Upcoming Deadlines</h2>{summary.data.upcomingDeadlineRecords.length ? <div className="list-stack">{summary.data.upcomingDeadlineRecords.map(item => <Link className="list-row" to="/deadlines" key={item.id}><div><strong>{item.description}</strong><span>Due {formatDate(item.dueDate)}</span></div><StatusBadge value={item.priority} /></Link>)}</div> : <EmptyState title="No upcoming deadlines" description="No deadline falls inside the configured window." />}</article>
        <article className="panel"><h2>Overdue Tasks</h2>{summary.data.overdueTaskRecords.length ? <div className="list-stack">{summary.data.overdueTaskRecords.map(item => <Link className="list-row" to={`/tasks/${item.id}`} key={item.id}><div><strong>{item.title}</strong><span>Due {formatDate(item.dueDate)}</span></div><StatusBadge value="Overdue" /></Link>)}</div> : <EmptyState title="No overdue tasks" description="There are no overdue tasks in the current filter." />}</article>
        <article className="panel"><h2>Engagement Status Summary</h2>{Object.keys(summary.data.engagementStatusSummary).length ? <div className="summary-bars">{Object.entries(summary.data.engagementStatusSummary).map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}</strong></div>)}</div> : <EmptyState title="No engagement data" description="Status counts will appear after engagements are created." />}</article>
        <article className="panel"><h2>Client Type Summary</h2>{Object.keys(summary.data.clientTypeSummary).length ? <div className="summary-bars">{Object.entries(summary.data.clientTypeSummary).map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}</strong></div>)}</div> : <EmptyState title="No client data" description="Client type counts will appear here." />}</article>
        <article className="panel"><h2>Recent Activity</h2>{summary.data.recentActivity.length ? <div className="list-stack">{summary.data.recentActivity.map(item => <Link className="list-row" to="/administration/activity" key={item.id}><div><strong>{item.action} · {item.entityType}</strong><span>{item.changedFieldSummary} · {formatDateTime(item.occurredAt)}</span></div></Link>)}</div> : <EmptyState title="No recent activity" description="Operational actions will be recorded here." />}</article>
      </section>
    </>}
  </>;
}
