import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppContext } from '../../components/AppContext';
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, StatCard, StatusBadge, ValidationSummary } from '../../components/ui';
import {
  emptyAcceptance, emptyEngagementLetter, emptyIndependence, emptyPlanningMemo, emptyPlanningMilestone, emptyTeam
} from '../../constants/defaults';
import {
  ACCEPTANCE_STATUSES, DEADLINE_STATUSES, ENGAGEMENT_LETTER_STATUSES, INDEPENDENCE_STATUSES,
  PLANNING_MEMO_STATUSES, PLANNING_MILESTONE_TYPES, PRIORITIES, RISK_RATINGS, THREAT_RESPONSES
} from '../../constants/statuses';
import { useAsyncData } from '../../hooks/useAsyncData';
import { services } from '../../services';
import type { AcceptanceInput } from '../../services/AcceptanceService';
import type { EngagementLetterInput } from '../../services/EngagementLetterService';
import type { IndependenceInput } from '../../services/IndependenceService';
import type { PlanningMemoInput } from '../../services/PlanningMemoService';
import type { PlanningMilestoneInput } from '../../services/PlanningMilestoneService';
import type { TeamInput } from '../../services/TeamService';
import type { BaseRecord, Staff, ThreatResponse } from '../../types/models';
import { formatDate, formatDateTime } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { AuditPhase2Sections, type Phase2Section } from '../auditPhase2/AuditPhase2Sections';
import { AuditPhase3Sections, type Phase3Section } from '../auditPhase3/AuditPhase3Sections';

const sections = [
  ['summary', 'Planning Summary'], ['acceptance', 'Acceptance & Continuance'], ['independence', 'Independence & Conflict'],
  ['letter', 'Engagement Letter'], ['memorandum', 'Planning Memorandum'], ['team-timeline', 'Team & Timeline'],
  ['risks', 'Risk Assessment'], ['materiality', 'Materiality'], ['programme', 'Audit Programme'],
  ['working-papers', 'Working Papers'], ['evidence', 'Evidence'], ['sampling', 'Sampling'],
  ['document-requests', 'Document Requests'],
  ['review-notes','Review Notes'], ['manager-review','Manager Review'], ['partner-review','Partner Review'],
  ['completion-checklist','Completion Checklist'], ['findings','Findings & Misstatements'], ['audit-reports','Audit Reports'],
  ['management-letter','Management Letter'], ['representation-letter','Representation Letter'], ['report-issue','Report Issue'],
  ['file-lock','File Lock'], ['amendments','Amendments'], ['activity', 'Activity']
] as const;
type SectionKey = (typeof sections)[number][0];
type EditableKeys = 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted';
function editable<T extends BaseRecord>(record: T): Omit<T, EditableKeys> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, createdByName: _createdByName, updatedByName: _updatedByName, recordVersion: _recordVersion, isDeleted: _isDeleted, ...rest } = record;
  return rest;
}
function errorDetails(error: unknown, fallback: string): string[] {
  return error instanceof ValidationError ? error.details ?? [error.message] : [error instanceof Error ? error.message : fallback];
}
function TextArea({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <Field label={label} required={required}><textarea value={value} onChange={event => onChange(event.target.value)} /></Field>;
}
function PersonSelect({ label, value, onChange, staff, role }: { label: string; value: string; onChange: (value: string) => void; staff: Staff[]; role?: Staff['role'] }) {
  return <Field label={label}><select value={value} onChange={event => onChange(event.target.value)}><option value="">Select staff</option>{staff.filter(item => item.isActive && !item.isDeleted && (!role || item.role === role)).map(item => <option key={item.id} value={item.id}>{item.fullName} · {item.role}</option>)}</select></Field>;
}

export function AuditPlanningPage() {
  const { id = '', section = 'summary' } = useParams();
  const activeSection = sections.some(item => item[0] === section) ? section as SectionKey : 'summary';
  const { revision, notifyDataChanged, showToast } = useAppContext();
  const [errors, setErrors] = useState<string[]>([]);
  const [acceptanceForm, setAcceptanceForm] = useState<AcceptanceInput>({ ...emptyAcceptance, engagementId: id });
  const [independenceForm, setIndependenceForm] = useState<IndependenceInput>({ ...emptyIndependence, engagementId: id });
  const [letterForm, setLetterForm] = useState<EngagementLetterInput>({ ...emptyEngagementLetter, engagementId: id });
  const [letterEditId, setLetterEditId] = useState('');
  const [memoForm, setMemoForm] = useState<PlanningMemoInput>({ ...emptyPlanningMemo, engagementId: id });
  const [teamForm, setTeamForm] = useState<TeamInput>({ ...emptyTeam, engagementId: id });
  const [teamEditId, setTeamEditId] = useState('');
  const [milestoneForm, setMilestoneForm] = useState<PlanningMilestoneInput>({ ...emptyPlanningMilestone, engagementId: id });
  const [milestoneEditId, setMilestoneEditId] = useState('');

  const data = useAsyncData(async () => {
    const engagement = await services.engagements.get(id);
    if (!engagement) throw new Error('Engagement not found.');
    const [staff, acceptance, independence, letters, memo, team, milestones] = await Promise.all([
      services.staff.list(true), services.acceptance.forEngagement(id), services.independence.forEngagement(id),
      services.engagementLetters.forEngagement(id), services.planningMemos.forEngagement(id), services.team.forEngagement(id), services.planningMilestones.forEngagement(id)
    ]);
    const readiness = engagement.serviceType === 'Audit' ? await services.planningGates.readiness(engagement, services.settings.get().upcomingDeadlineDays) : null;
    const eventQueries = [services.activity.forEntity('Engagement', id)];
    if (acceptance) eventQueries.push(services.activity.forEntity('Acceptance Review', acceptance.id));
    if (independence) eventQueries.push(services.activity.forEntity('Independence Assessment', independence.id));
    if (memo) eventQueries.push(services.activity.forEntity('Audit Planning Memo', memo.id));
    for (const record of letters) eventQueries.push(services.activity.forEntity('Engagement Letter', record.id));
    for (const record of team) eventQueries.push(services.activity.forEntity('Engagement Team', record.id));
    for (const record of milestones) eventQueries.push(services.activity.forEntity('Planning Milestone', record.id));
    const planningActivity = (await Promise.all(eventQueries)).flat().sort((a,b) => b.occurredAt.localeCompare(a.occurredAt));
    return { engagement, staff, acceptance, independence, letters, memo, team, milestones, readiness, planningActivity };
  }, [id, revision]);

  useEffect(() => {
    if (!data.data) return;
    const { engagement, acceptance, independence, memo } = data.data;
    setAcceptanceForm(acceptance ? editable(acceptance) : { ...emptyAcceptance, engagementId: id, managerReviewerId: engagement.responsibleManagerId, partnerApproverId: engagement.responsiblePartnerId });
    setIndependenceForm(independence ? editable(independence) : { ...emptyIndependence, engagementId: id, assessmentDate: new Date().toISOString().slice(0,10), assessedById: engagement.responsibleManagerId });
    setMemoForm(memo ? editable(memo) : { ...emptyPlanningMemo, engagementId: id, managerReviewerId: engagement.responsibleManagerId, partnerApproverId: engagement.responsiblePartnerId });
  }, [data.data?.acceptance?.id, data.data?.independence?.id, data.data?.memo?.id, id]);

  const operator = services.settings.get().operatorName;
  const staffName = (staffId: string) => data.data?.staff.find(item => item.id === staffId)?.fullName ?? 'Missing/archived staff';
  const save = async (action: () => Promise<unknown>, message: string) => {
    setErrors([]);
    try { await action(); notifyDataChanged(); showToast(message); }
    catch (error) { setErrors(errorDetails(error, 'Unable to save Audit Planning record.')); }
  };

  if (data.loading) return <LoadingState />;
  if (data.error || !data.data) return <ErrorState message={data.error || 'Engagement not found.'} onRetry={data.reload} />;
  const { engagement, staff, acceptance, independence, letters, memo, team, milestones, readiness, planningActivity } = data.data;
  if (engagement.serviceType !== 'Audit') return <><PageHeader title="Audit Planning unavailable" description="Audit workflow modules apply only to Audit engagements." actions={<Link className="button secondary" to={`/engagements/${id}`}>Back to Engagement</Link>} /><div className="alert warning">This is a non-audit engagement. No Audit Planning data or controls are available.</div></>;
  const engagementReadOnly = engagement.status === 'Locked' || engagement.status === 'Closed';
  const acceptanceReadOnly = engagementReadOnly || acceptance?.status === 'Locked';
  const independenceReadOnly = engagementReadOnly || independence?.status === 'Locked';
  const memoReadOnly = engagementReadOnly || memo?.status === 'Locked' || memo?.status === 'Approved';
  const pageTitle = sections.find(item => item[0] === activeSection)?.[1] ?? 'Audit Planning';

  return <>
    <PageHeader title={`Audit Planning · ${pageTitle}`} description={`${engagement.engagementCode} · ${engagement.engagementType}`} actions={<Link className="button secondary" to={`/engagements/${id}`}>Engagement Workspace</Link>} />
    {engagementReadOnly && <div className="alert warning read-only-banner"><strong>Read-only engagement</strong><span>{engagement.status} engagements and all linked planning records cannot be changed.</span></div>}
    <nav className="planning-nav" aria-label="Audit Planning sections">{sections.map(([key, label]) => <Link key={key} className={activeSection === key ? 'active' : ''} to={`/engagements/${id}/audit-planning/${key}`}>{label}</Link>)}</nav>
    <ValidationSummary errors={errors} />

    {activeSection === 'summary' && readiness && <section className="planning-summary">
      <div className="readiness-card panel"><div className="readiness-ring" style={{ '--readiness': `${readiness.percentage}%` } as React.CSSProperties}><strong>{readiness.percentage}%</strong><span>ready</span></div><div><h2>Planning Readiness</h2><p>{readiness.completedCriteria} of {readiness.totalCriteria} validated readiness criteria are complete.</p></div></div>
      <div className="stats-grid compact">
        <StatCard label="Acceptance" value={readiness.acceptanceStatus} /><StatCard label="Independence" value={readiness.independenceStatus} />
        <StatCard label="Engagement Letter" value={readiness.letterStatus} /><StatCard label="Planning Memorandum" value={readiness.planningMemoStatus} />
        <StatCard label="Materiality" value={readiness.materialityStatus} /><StatCard label="Significant/Fraud Risks" value={readiness.significantFraudRisksReady ? 'Ready' : 'Pending'} />
        <StatCard label="Team Size" value={readiness.teamSize} /><StatCard label="Planned Hours" value={readiness.plannedHours} />
        <StatCard label="Upcoming Milestones" value={readiness.upcomingMilestones.length} /><StatCard label="Overdue Planning Items" value={readiness.overdueMilestones.length} />
      </div>
      <section className="dashboard-grid">
        <article className="panel"><h2>Planning Gates</h2>{readiness.blockingItems.length ? <ul className="blocking-list">{readiness.blockingItems.map(item => <li key={item}>{item}</li>)}</ul> : <div className="alert success"><strong>All Phase 2 readiness criteria satisfied.</strong><span>The engagement is ready for the validated Fieldwork gate.</span></div>}</article>
        <article className="panel"><h2>Responsibility</h2><dl className="detail-grid"><dt>Responsible Partner</dt><dd>{staffName(engagement.responsiblePartnerId)}</dd><dt>Responsible Manager</dt><dd>{staffName(engagement.responsibleManagerId)}</dd><dt>Current Engagement Status</dt><dd><StatusBadge value={engagement.status} /></dd></dl></article>
        <article className="panel"><h2>Upcoming Planning Milestones</h2>{readiness.upcomingMilestones.length ? readiness.upcomingMilestones.map(item => <div className="list-row" key={item.id}><div><strong>{item.milestoneType}</strong><span>{formatDate(item.dueDate)}</span></div><StatusBadge value={item.priority} /></div>) : <EmptyState title="No upcoming milestones" description="No open milestone falls within the configured window." />}</article>
        <article className="panel"><h2>Planning Activity History</h2>{planningActivity.length ? <div className="timeline">{planningActivity.slice(0,12).map(item => <div key={item.id}><strong>{item.action} · {item.entityType}</strong><span>{item.changedFieldSummary}</span><small>{formatDateTime(item.occurredAt)} · {item.operatorName}</small></div>)}</div> : <EmptyState title="No planning activity" description="Planning actions will be recorded here." />}</article>
      </section>
    </section>}

    {activeSection === 'acceptance' && <form className="panel form-panel" onSubmit={event => { event.preventDefault(); void save(() => services.acceptance.save(acceptanceForm, operator, acceptance?.id), 'Acceptance / Continuance saved.'); }}>
      <div className="panel-header"><div><h2>Client Acceptance / Continuance</h2><p>Document ethical acceptance and continuance decisions before Audit Planning.</p></div><StatusBadge value={acceptance?.status ?? acceptanceForm.status} /></div>
      <fieldset disabled={acceptanceReadOnly}><div className="form-grid">
        <Field label="Review Type" required><select value={acceptanceForm.reviewType} onChange={e => setAcceptanceForm({ ...acceptanceForm, reviewType: e.target.value as AcceptanceInput['reviewType'] })}><option>New Client Acceptance</option><option>Existing Client Continuance</option></select></Field>
        <Field label="Status"><select value={acceptanceForm.status} onChange={e => setAcceptanceForm({ ...acceptanceForm, status: e.target.value as AcceptanceInput['status'] })}>{ACCEPTANCE_STATUSES.map(item => <option key={item}>{item}</option>)}</select></Field>
        <TextArea label="Client Background Summary" required value={acceptanceForm.clientBackgroundSummary} onChange={value => setAcceptanceForm({ ...acceptanceForm, clientBackgroundSummary: value })} />
        <TextArea label="Nature of Business" required value={acceptanceForm.natureOfBusiness} onChange={value => setAcceptanceForm({ ...acceptanceForm, natureOfBusiness: value })} />
        <TextArea label="Ownership and Management Summary" value={acceptanceForm.ownershipManagementSummary} onChange={value => setAcceptanceForm({ ...acceptanceForm, ownershipManagementSummary: value })} />
        <TextArea label="Reason for Appointment / Reappointment" value={acceptanceForm.reasonForAppointment} onChange={value => setAcceptanceForm({ ...acceptanceForm, reasonForAppointment: value })} />
        <TextArea label="Previous Auditor Details" value={acceptanceForm.previousAuditorDetails} onChange={value => setAcceptanceForm({ ...acceptanceForm, previousAuditorDetails: value })} />
        <TextArea label="Management Integrity Assessment" required value={acceptanceForm.managementIntegrityAssessment} onChange={value => setAcceptanceForm({ ...acceptanceForm, managementIntegrityAssessment: value })} />
        <Field label="Engagement Risk Rating"><select value={acceptanceForm.engagementRiskRating} onChange={e => setAcceptanceForm({ ...acceptanceForm, engagementRiskRating: e.target.value as AcceptanceInput['engagementRiskRating'] })}>{RISK_RATINGS.map(item => <option key={item}>{item}</option>)}</select></Field>
        <TextArea label="Financial Reporting Framework" required value={acceptanceForm.financialReportingFramework} onChange={value => setAcceptanceForm({ ...acceptanceForm, financialReportingFramework: value })} />
        <TextArea label="Regulatory Environment" value={acceptanceForm.regulatoryEnvironment} onChange={value => setAcceptanceForm({ ...acceptanceForm, regulatoryEnvironment: value })} />
        <TextArea label="Competence and Resources Available" required value={acceptanceForm.competenceResourcesAvailable} onChange={value => setAcceptanceForm({ ...acceptanceForm, competenceResourcesAvailable: value })} />
        <TextArea label="Ethical Threats Identified" value={acceptanceForm.ethicalThreatsIdentified} onChange={value => setAcceptanceForm({ ...acceptanceForm, ethicalThreatsIdentified: value })} />
        <TextArea label="Safeguards Applied" value={acceptanceForm.safeguardsApplied} onChange={value => setAcceptanceForm({ ...acceptanceForm, safeguardsApplied: value })} />
        <TextArea label="Acceptance Recommendation" required value={acceptanceForm.acceptanceRecommendation} onChange={value => setAcceptanceForm({ ...acceptanceForm, acceptanceRecommendation: value })} />
        <PersonSelect label="Manager Reviewer" value={acceptanceForm.managerReviewerId} onChange={value => setAcceptanceForm({ ...acceptanceForm, managerReviewerId: value })} staff={staff} role="Manager" />
        <PersonSelect label="Partner Approver" value={acceptanceForm.partnerApproverId} onChange={value => setAcceptanceForm({ ...acceptanceForm, partnerApproverId: value })} staff={staff} role="Partner" />
        <Field label="Manager Review Date"><input type="date" value={acceptanceForm.managerReviewDate} onChange={e => setAcceptanceForm({ ...acceptanceForm, managerReviewDate: e.target.value })} /></Field>
        <Field label="Partner Approval Date"><input type="date" value={acceptanceForm.partnerApprovalDate} onChange={e => setAcceptanceForm({ ...acceptanceForm, partnerApprovalDate: e.target.value })} /></Field>
        <TextArea label="Rejection Reason" value={acceptanceForm.rejectionReason} onChange={value => setAcceptanceForm({ ...acceptanceForm, rejectionReason: value })} />
        <TextArea label="Notes" value={acceptanceForm.notes} onChange={value => setAcceptanceForm({ ...acceptanceForm, notes: value })} />
      </div></fieldset>{!acceptanceReadOnly && <div className="form-actions"><button className="button primary">Save Acceptance Record</button></div>}
    </form>}

    {activeSection === 'independence' && <form className="panel form-panel" onSubmit={event => { event.preventDefault(); void save(() => services.independence.save(independenceForm, operator, independence?.id), 'Independence assessment saved.'); }}>
      <div className="panel-header"><div><h2>Independence and Conflict Assessment</h2><p>Evaluate threats, safeguards and clearance at engagement level.</p></div><StatusBadge value={independence?.status ?? independenceForm.status} /></div>
      <fieldset disabled={independenceReadOnly}><div className="form-grid">
        <Field label="Assessment Date" required><input type="date" value={independenceForm.assessmentDate} onChange={e => setIndependenceForm({ ...independenceForm, assessmentDate: e.target.value })} /></Field>
        <PersonSelect label="Assessed By" value={independenceForm.assessedById} onChange={value => setIndependenceForm({ ...independenceForm, assessedById: value })} staff={staff} />
        <Field label="Status"><select value={independenceForm.status} onChange={e => setIndependenceForm({ ...independenceForm, status: e.target.value as IndependenceInput['status'] })}>{INDEPENDENCE_STATUSES.map(item => <option key={item}>{item}</option>)}</select></Field>
        {([
          ['financialInterestThreat','Financial Interest Threat'], ['businessRelationshipThreat','Business Relationship Threat'], ['familyPersonalRelationshipThreat','Family/Personal Relationship Threat'],
          ['employmentRelationshipThreat','Employment Relationship Threat'], ['longAssociationThreat','Long Association Threat'], ['nonAuditServiceThreat','Non-Audit Service Threat'],
          ['feeDependencyThreat','Fee Dependency Threat'], ['litigationThreat','Litigation Threat'], ['otherThreat','Other Threat'], ['conflictFound','Conflict Found']
        ] as const).map(([field,label]) => <Field key={field} label={label}><select value={independenceForm[field]} onChange={e => setIndependenceForm({ ...independenceForm, [field]: e.target.value as ThreatResponse })}>{THREAT_RESPONSES.map(item => <option key={item}>{item}</option>)}</select></Field>)}
        <TextArea label="Threat Description" value={independenceForm.threatDescription} onChange={value => setIndependenceForm({ ...independenceForm, threatDescription: value })} />
        <TextArea label="Safeguards" value={independenceForm.safeguards} onChange={value => setIndependenceForm({ ...independenceForm, safeguards: value })} />
        <TextArea label="Conclusion" value={independenceForm.conclusion} onChange={value => setIndependenceForm({ ...independenceForm, conclusion: value })} />
        <label className="checkbox-card"><input type="checkbox" checked={independenceForm.managerReviewed} onChange={e => setIndependenceForm({ ...independenceForm, managerReviewed: e.target.checked })} /><span><strong>Manager Review Completed</strong><small>Required before Partner Clearance.</small></span></label>
        <label className="checkbox-card"><input type="checkbox" checked={independenceForm.partnerCleared} onChange={e => setIndependenceForm({ ...independenceForm, partnerCleared: e.target.checked })} /><span><strong>Partner Clearance Completed</strong><small>Required for Cleared status.</small></span></label>
        <TextArea label="Notes" value={independenceForm.notes} onChange={value => setIndependenceForm({ ...independenceForm, notes: value })} />
      </div></fieldset>{!independenceReadOnly && <div className="form-actions"><button className="button primary">Save Independence Assessment</button></div>}
    </form>}

    {activeSection === 'letter' && <section className="split-layout align-start">
      <article className="panel"><div className="panel-header"><h2>Engagement Letter Register</h2>{!engagementReadOnly && <button className="button secondary small" onClick={() => { setLetterEditId(''); setLetterForm({ ...emptyEngagementLetter, engagementId: id, letterVersion: Math.max(0, ...letters.map(item => item.letterVersion)) + 1 }); }}>New Version</button>}</div>{letters.length ? <div className="list-stack">{letters.map(item => <div className="list-row" key={item.id}><div><strong>{item.letterReference} · v{item.letterVersion}</strong><span>{item.fileReference || 'Metadata only'} · {item.clientAcceptanceDate ? `Accepted ${formatDate(item.clientAcceptanceDate)}` : 'Not accepted'}</span></div><div className="row-actions"><StatusBadge value={item.status} />{!engagementReadOnly && <button className="button small" onClick={() => { setLetterEditId(item.id); setLetterForm(editable(item)); }}>Edit</button>}</div></div>)}</div> : <EmptyState title="No engagement letters" description="Create metadata for the first engagement letter. Actual files are intentionally not stored." />}</article>
      {!engagementReadOnly && <form className="panel" onSubmit={event => { event.preventDefault(); void save(() => services.engagementLetters.save(letterForm, operator, letterEditId || undefined), 'Engagement letter saved.').then(() => { setLetterEditId(''); setLetterForm({ ...emptyEngagementLetter, engagementId: id }); }); }}><h2>{letterEditId ? 'Edit Letter Metadata' : 'New Letter Metadata'}</h2><div className="form-grid single">
        <Field label="Letter Reference" required><input value={letterForm.letterReference} onChange={e => setLetterForm({ ...letterForm, letterReference: e.target.value })} /></Field><Field label="Letter Version"><input type="number" min="1" value={letterForm.letterVersion} onChange={e => setLetterForm({ ...letterForm, letterVersion: Number(e.target.value) })} /></Field>
        <Field label="Status"><select value={letterForm.status} onChange={e => setLetterForm({ ...letterForm, status: e.target.value as EngagementLetterInput['status'] })}>{ENGAGEMENT_LETTER_STATUSES.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Draft Date"><input type="date" value={letterForm.draftDate} onChange={e => setLetterForm({ ...letterForm, draftDate: e.target.value })} /></Field><Field label="Sent to Client Date"><input type="date" value={letterForm.sentToClientDate} onChange={e => setLetterForm({ ...letterForm, sentToClientDate: e.target.value })} /></Field><Field label="Client Acceptance Date"><input type="date" value={letterForm.clientAcceptanceDate} onChange={e => setLetterForm({ ...letterForm, clientAcceptanceDate: e.target.value })} /></Field><Field label="Effective Date"><input type="date" value={letterForm.effectiveDate} onChange={e => setLetterForm({ ...letterForm, effectiveDate: e.target.value })} /></Field><Field label="Expiry Date"><input type="date" value={letterForm.expiryDate} onChange={e => setLetterForm({ ...letterForm, expiryDate: e.target.value })} /></Field>
        <TextArea label="Scope Summary" value={letterForm.scopeSummary} onChange={value => setLetterForm({ ...letterForm, scopeSummary: value })} /><TextArea label="Responsibilities Summary" value={letterForm.responsibilitiesSummary} onChange={value => setLetterForm({ ...letterForm, responsibilitiesSummary: value })} /><TextArea label="Reporting Framework" value={letterForm.reportingFramework} onChange={value => setLetterForm({ ...letterForm, reportingFramework: value })} /><TextArea label="Fee Terms Summary" value={letterForm.feeTermsSummary} onChange={value => setLetterForm({ ...letterForm, feeTermsSummary: value })} />
        <label className="checkbox-field"><input type="checkbox" checked={letterForm.signedByFirm} onChange={e => setLetterForm({ ...letterForm, signedByFirm: e.target.checked })} /> Signed by Firm</label><label className="checkbox-field"><input type="checkbox" checked={letterForm.signedByClient} onChange={e => setLetterForm({ ...letterForm, signedByClient: e.target.checked })} /> Signed by Client</label>
        <Field label="Client Signatory"><input value={letterForm.clientSignatory} onChange={e => setLetterForm({ ...letterForm, clientSignatory: e.target.value })} /></Field><Field label="File Reference" hint="Reference metadata only—no document upload."><input value={letterForm.fileReference} onChange={e => setLetterForm({ ...letterForm, fileReference: e.target.value })} /></Field><TextArea label="Notes" value={letterForm.notes} onChange={value => setLetterForm({ ...letterForm, notes: value })} />
      </div><div className="form-actions"><button className="button primary">Save Letter</button></div></form>}
    </section>}

    {activeSection === 'memorandum' && <form className="panel form-panel" onSubmit={event => { event.preventDefault(); void save(() => services.planningMemos.save(memoForm, operator, memo?.id), 'Planning Memorandum saved.'); }}>
      <div className="panel-header"><div><h2>Audit Planning Memorandum</h2><p>Structured audit planning memorandum integrated with Risk Assessment and Materiality gates.</p></div><StatusBadge value={memo?.status ?? memoForm.status} /></div>
      {memo?.status === 'Approved' && !engagementReadOnly && <div className="alert warning"><strong>Approved planning is read-only.</strong><span>Use controlled reopen and document the reason before editing.</span><button type="button" className="button secondary small" onClick={() => { const reason = window.prompt('Reason for reopening Approved planning:') ?? ''; if (reason.trim()) void save(() => services.planningMemos.reopen(memo.id, reason, operator), 'Planning Memorandum reopened.'); }}>Controlled Reopen</button></div>}
      <fieldset disabled={memoReadOnly}><div className="form-grid">
        <Field label="Status"><select value={memoForm.status} onChange={e => setMemoForm({ ...memoForm, status: e.target.value as PlanningMemoInput['status'] })}>{PLANNING_MEMO_STATUSES.map(item => <option key={item}>{item}</option>)}</select></Field>
        {([
          ['entityUnderstanding','Entity Understanding'], ['businessModelSummary','Business Model Summary'], ['industryRegulatoryFactors','Industry and Regulatory Factors'], ['ownershipGovernance','Ownership and Governance'], ['keyManagement','Key Management'], ['financialReportingFramework','Financial Reporting Framework'], ['significantAccountingPolicies','Significant Accounting Policies'], ['priorYearAuditIssues','Prior-Year Audit Issues'], ['currentYearSignificantChanges','Current-Year Significant Changes'], ['internalControlEnvironmentSummary','Internal Control Environment Summary'], ['useOfExperts','Use of Experts'], ['useOfInternalAudit','Use of Internal Audit'], ['componentBranchConsiderations','Component / Branch Considerations'], ['goingConcernPreliminaryAssessment','Going Concern Preliminary Assessment'], ['fraudConsiderations','Fraud Considerations'], ['relatedPartyConsiderations','Related Party Considerations'], ['plannedAuditApproach','Planned Audit Approach'], ['keyMilestones','Key Milestones'], ['reportingDeliverables','Reporting Deliverables']
        ] as const).map(([field,label]) => <TextArea key={field} label={label} required={field === 'entityUnderstanding' || field === 'plannedAuditApproach'} value={memoForm[field]} onChange={value => setMemoForm({ ...memoForm, [field]: value })} />)}
        <PersonSelect label="Manager Reviewer" value={memoForm.managerReviewerId} onChange={value => setMemoForm({ ...memoForm, managerReviewerId: value })} staff={staff} role="Manager" /><PersonSelect label="Partner Approver" value={memoForm.partnerApproverId} onChange={value => setMemoForm({ ...memoForm, partnerApproverId: value })} staff={staff} role="Partner" />
        <Field label="Manager Review Date"><input type="date" value={memoForm.managerReviewDate} onChange={e => setMemoForm({ ...memoForm, managerReviewDate: e.target.value })} /></Field><Field label="Partner Approval Date"><input type="date" value={memoForm.partnerApprovalDate} onChange={e => setMemoForm({ ...memoForm, partnerApprovalDate: e.target.value })} /></Field><TextArea label="Notes / Return Comments" value={memoForm.notes} onChange={value => setMemoForm({ ...memoForm, notes: value })} />
      </div></fieldset>{!memoReadOnly && <div className="form-actions"><button className="button primary">Save Planning Memorandum</button></div>}
    </form>}

    {activeSection === 'team-timeline' && <section className="dashboard-grid planning-team-grid">
      <article className="panel"><div className="panel-header"><h2>Planning Team Summary</h2><strong>{team.reduce((sum,item) => sum + (item.isActive ? item.estimatedHours : 0), 0)} planned hours</strong></div>{team.length ? <div className="list-stack">{team.map(item => <div className="list-row" key={item.id}><div><strong>{staffName(item.staffId)}</strong><span>{item.assignmentRole} · {item.estimatedHours} hours · {item.responsibilityArea || item.responsibilityNotes || 'No responsibility area'}</span><span>{formatDate(item.startDate)} – {formatDate(item.endDate)}</span></div><div className="row-actions"><StatusBadge value={item.isActive ? 'Active' : 'Inactive'} />{!engagementReadOnly && <button className="button small" onClick={() => { setTeamEditId(item.id); setTeamForm(editable(item)); }}>Edit</button>}</div></div>)}</div> : <EmptyState title="No planning team" description="Assign the Responsible Partner and Manager before Fieldwork." />}</article>
      {!engagementReadOnly && <form className="panel" onSubmit={event => { event.preventDefault(); void save(() => services.team.save(teamForm, operator, teamEditId || undefined), 'Planning team updated.').then(() => { setTeamEditId(''); setTeamForm({ ...emptyTeam, engagementId: id }); }); }}><h2>{teamEditId ? 'Edit Team Assignment' : 'Add Team Assignment'}</h2><div className="form-grid single"><PersonSelect label="Staff" value={teamForm.staffId} onChange={value => { const selected = staff.find(item => item.id === value); setTeamForm({ ...teamForm, staffId: value, assignmentRole: selected?.role ?? teamForm.assignmentRole }); }} staff={staff} /><Field label="Staff Role"><input value={teamForm.assignmentRole} onChange={e => setTeamForm({ ...teamForm, assignmentRole: e.target.value })} /></Field><Field label="Planned Hours"><input type="number" min="0.5" step="0.5" value={teamForm.estimatedHours} onChange={e => setTeamForm({ ...teamForm, estimatedHours: Number(e.target.value) })} /></Field><Field label="Planned Start Date"><input type="date" value={teamForm.startDate} onChange={e => setTeamForm({ ...teamForm, startDate: e.target.value })} /></Field><Field label="Planned End Date"><input type="date" value={teamForm.endDate} onChange={e => setTeamForm({ ...teamForm, endDate: e.target.value })} /></Field><Field label="Responsibility Area"><input value={teamForm.responsibilityArea ?? ''} onChange={e => setTeamForm({ ...teamForm, responsibilityArea: e.target.value })} /></Field><TextArea label="Responsibility Notes" value={teamForm.responsibilityNotes} onChange={value => setTeamForm({ ...teamForm, responsibilityNotes: value })} /><label className="checkbox-field"><input type="checkbox" checked={teamForm.isActive} onChange={e => setTeamForm({ ...teamForm, isActive: e.target.checked, status: e.target.checked ? 'Active' : 'Inactive' })} /> Active assignment</label></div><button className="button primary">Save Team Assignment</button></form>}
      <article className="panel"><div className="panel-header"><h2>Engagement Milestones</h2><span>{milestones.length} recorded</span></div>{milestones.length ? <div className="list-stack">{milestones.map(item => <div className="list-row" key={item.id}><div><strong>{item.milestoneType}</strong><span>{item.description} · Due {formatDate(item.dueDate)} · {staffName(item.ownerId)}</span></div><div className="row-actions"><StatusBadge value={services.planningMilestones.isOverdue(item) ? 'Overdue' : item.status} />{!engagementReadOnly && <button className="button small" onClick={() => { setMilestoneEditId(item.id); setMilestoneForm(editable(item)); }}>Edit</button>}</div></div>)}</div> : <EmptyState title="No planning milestones" description="Add all required planning and reporting milestones." />}</article>
      {!engagementReadOnly && <form className="panel" onSubmit={event => { event.preventDefault(); void save(() => services.planningMilestones.save(milestoneForm, operator, milestoneEditId || undefined), 'Planning milestone saved.').then(() => { setMilestoneEditId(''); setMilestoneForm({ ...emptyPlanningMilestone, engagementId: id }); }); }}><h2>{milestoneEditId ? 'Edit Milestone' : 'Add Milestone'}</h2><div className="form-grid single"><Field label="Milestone Type"><select value={milestoneForm.milestoneType} onChange={e => setMilestoneForm({ ...milestoneForm, milestoneType: e.target.value })}>{PLANNING_MILESTONE_TYPES.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Description"><input value={milestoneForm.description} onChange={e => setMilestoneForm({ ...milestoneForm, description: e.target.value })} /></Field><Field label="Due Date"><input type="date" value={milestoneForm.dueDate} onChange={e => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })} /></Field><PersonSelect label="Owner" value={milestoneForm.ownerId} onChange={value => setMilestoneForm({ ...milestoneForm, ownerId: value })} staff={staff} /><Field label="Priority"><select value={milestoneForm.priority} onChange={e => setMilestoneForm({ ...milestoneForm, priority: e.target.value as PlanningMilestoneInput['priority'] })}>{PRIORITIES.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Status"><select value={milestoneForm.status} onChange={e => setMilestoneForm({ ...milestoneForm, status: e.target.value as PlanningMilestoneInput['status'] })}>{DEADLINE_STATUSES.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Completion Date"><input type="date" value={milestoneForm.completionDate} onChange={e => setMilestoneForm({ ...milestoneForm, completionDate: e.target.value })} /></Field><Field label="Change Reason"><input value={milestoneForm.changeReason} onChange={e => setMilestoneForm({ ...milestoneForm, changeReason: e.target.value })} /></Field></div><button className="button primary">Save Milestone</button></form>}
    </section>}

    {(['risks','materiality','programme','working-papers','evidence','sampling','document-requests','activity'] as Phase2Section[]).includes(activeSection as Phase2Section) &&
      <AuditPhase2Sections engagementId={id} section={activeSection as Phase2Section} readOnly={engagementReadOnly} />}
    {(['review-notes','manager-review','partner-review','completion-checklist','findings','audit-reports','management-letter','representation-letter','report-issue','file-lock','amendments'] as Phase3Section[]).includes(activeSection as Phase3Section) &&
      <AuditPhase3Sections engagementId={id} section={activeSection as Phase3Section} readOnly={engagementReadOnly} />}

  </>;
}
