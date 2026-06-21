import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { services } from '../services';
import { emptyEngagement } from '../constants/defaults';
import type { EngagementInput } from '../services/EngagementService';
import { useAppContext } from '../components/AppContext';
import { ErrorState, Field, ListedBadge, LoadingState, PageHeader, ValidationSummary } from '../components/ui';
import { PRIORITIES, RISK_RATINGS, SERVICE_TYPES } from '../constants/statuses';
import { ValidationError } from '../utils/errors';

export function EngagementFormPage() {
  const { id } = useParams(); const navigate = useNavigate(); const { notifyDataChanged, showToast } = useAppContext();
  const [form, setForm] = useState<EngagementInput>(emptyEngagement); const [clients, setClients] = useState<Awaited<ReturnType<typeof services.clients.list>>>([]); const [staff, setStaff] = useState<Awaited<ReturnType<typeof services.staff.list>>>([]); const [servicesList, setServicesList] = useState<string[]>(SERVICE_TYPES); const [loading, setLoading] = useState(true); const [errors, setErrors] = useState<string[]>([]); const [saving, setSaving] = useState(false);
  useEffect(() => { void (async () => { try { const [allClients, allStaff, allEngagements, masterServices] = await Promise.all([services.clients.list(), services.staff.list(), services.engagements.list(true), services.serviceMaster.list()]); setClients(allClients.filter(item => item.status === 'Active')); setStaff(allStaff); setServicesList(masterServices.filter(item => item.isActive).map(item => item.name).length ? masterServices.filter(item => item.isActive).map(item => item.name) : SERVICE_TYPES); if (id) { const item = await services.engagements.get(id); if (item) setForm(item); } else setForm({ ...emptyEngagement, engagementCode: services.settings.generateNextCode('engagement', allEngagements.map(item => item.engagementCode)) }); } catch (error) { setErrors([error instanceof Error ? error.message : 'Unable to load engagement form.']); } finally { setLoading(false); } })(); }, [id]);
  const set = <K extends keyof EngagementInput>(key: K, value: EngagementInput[K]) => setForm(current => ({ ...current, [key]: value }));
  const setFinancial = <K extends keyof EngagementInput['financial']>(key: K, value: EngagementInput['financial'][K]) => setForm(current => ({ ...current, financial: { ...current.financial, [key]: value } }));
  async function submit(event: React.FormEvent) { event.preventDefault(); setErrors([]); setSaving(true); try { const operator = services.settings.get().operatorName; const saved = id ? await services.engagements.update(id, form, operator) : await services.engagements.create(form, operator); notifyDataChanged(); showToast(id ? 'Engagement updated.' : 'Engagement created.'); navigate(`/engagements/${saved.id}`); } catch (error) { setErrors(error instanceof ValidationError ? error.details ?? [error.message] : [error instanceof Error ? error.message : 'Unable to save engagement.']); } finally { setSaving(false); } }
  const selectedClient = clients.find(item => item.id === form.clientId);
  if (loading) return <LoadingState />;
  if (id && ['Locked', 'Closed'].includes(form.status)) return <><PageHeader title="Read-only Engagement" description={`This engagement is ${form.status}.`} actions={<Link className="button secondary" to={`/engagements/${id}`}>Back</Link>} /><ErrorState message="Locked or Closed engagements cannot be edited through the normal workflow." /></>;
  const engagementStatuses = services.settings.get().statusSettings.filter(item => item.entity === 'Engagement' && (item.isActive || item.value === form.status)).map(item => item.value as EngagementInput['status']);
  return <><PageHeader title={id ? 'Edit Engagement' : 'New Engagement'} description="Phase 1 engagement setup and basic financial summary." actions={<Link className="button secondary" to={id ? `/engagements/${id}` : '/engagements'}>Cancel</Link>} />
    {!clients.length && !id && <div className="alert warning"><strong>An Active client is required.</strong><span>Create or activate a client before saving an engagement.</span></div>}
    <form className="panel form-panel" onSubmit={submit}><ValidationSummary errors={errors} /><h2>Engagement identity</h2><div className="form-grid">
      <Field label="Engagement Code" required><input value={form.engagementCode} onChange={event => set('engagementCode', event.target.value)} /></Field>
      <Field label="Client" required><select value={form.clientId} onChange={event => { const value = event.target.value; const client = clients.find(item => item.id === value); setForm(current => ({ ...current, clientId: value, listedPieWorkflowRequired: Boolean(client?.isListedPie) || current.listedPieWorkflowRequired })); }}><option value="">Select Active client</option>{clients.map(item => <option key={item.id} value={item.id}>{item.clientCode} · {item.legalName}</option>)}</select></Field>
      <Field label="Service Type"><select value={form.serviceType} onChange={event => set('serviceType', event.target.value)}>{servicesList.map(item => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Engagement Type" required><input value={form.engagementType} onChange={event => set('engagementType', event.target.value)} placeholder="Statutory Audit, Tax Return…" /></Field>
      <Field label="Financial Period Start"><input type="date" value={form.financialPeriodStart} onChange={event => set('financialPeriodStart', event.target.value)} /></Field>
      <Field label="Financial Period End"><input type="date" value={form.financialPeriodEnd} onChange={event => set('financialPeriodEnd', event.target.value)} /></Field>
      <Field label="Start Date"><input type="date" value={form.startDate} onChange={event => set('startDate', event.target.value)} /></Field>
      <Field label="Target Completion Date"><input type="date" value={form.targetCompletionDate} onChange={event => set('targetCompletionDate', event.target.value)} /></Field>
      <Field label="Reporting Deadline"><input type="date" value={form.reportingDeadline} onChange={event => set('reportingDeadline', event.target.value)} /></Field>
      <Field label="Status"><select value={form.status} onChange={event => set('status', event.target.value as EngagementInput['status'])}>{engagementStatuses.map(item => <option key={item}>{item}</option>)}</select></Field>
      {selectedClient?.isListedPie && <div className="field"><span>Client Classification</span><ListedBadge /></div>}
      <label className="checkbox-card"><input type="checkbox" checked={form.listedPieWorkflowRequired} disabled={selectedClient?.isListedPie} onChange={event => set('listedPieWorkflowRequired', event.target.checked)} /><span><strong>Listed/PIE workflow required</strong><small>Automatically enabled for listed clients.</small></span></label>
    </div><h2>Responsibility and scope</h2><div className="form-grid">
      <Field label="Responsible Partner"><select value={form.responsiblePartnerId} onChange={event => set('responsiblePartnerId', event.target.value)}><option value="">Select</option>{staff.filter(item => item.role === 'Partner' && item.isActive).map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field>
      <Field label="Responsible Manager"><select value={form.responsibleManagerId} onChange={event => set('responsibleManagerId', event.target.value)}><option value="">Select</option>{staff.filter(item => item.role === 'Manager' && item.isActive).map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field>
      <Field label="Risk Rating"><select value={form.riskRating} onChange={event => set('riskRating', event.target.value as EngagementInput['riskRating'])}>{RISK_RATINGS.map(item => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Priority"><select value={form.priority} onChange={event => set('priority', event.target.value as EngagementInput['priority'])}>{PRIORITIES.map(item => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Scope Summary"><textarea value={form.scopeSummary} onChange={event => set('scopeSummary', event.target.value)} /></Field>
      <Field label="Duplicate Override Reason" hint="Required only when a duplicate is detected."><textarea value={form.duplicateOverrideReason ?? ''} onChange={event => set('duplicateOverrideReason', event.target.value)} /></Field>
      <Field label="Notes"><textarea value={form.notes} onChange={event => set('notes', event.target.value)} /></Field>
    </div><h2>Basic Financial Summary</h2><div className="form-grid">
      <Field label="Proposed Fee"><input type="number" min="0" step="0.01" value={form.financial.proposedFee} onChange={event => setFinancial('proposedFee', Number(event.target.value))} /></Field>
      <Field label="Approved Fee"><input type="number" min="0" step="0.01" value={form.financial.approvedFee} onChange={event => setFinancial('approvedFee', Number(event.target.value))} /></Field>
      <Field label="Budget Hours"><input type="number" min="0" step="0.5" value={form.financial.budgetHours} onChange={event => setFinancial('budgetHours', Number(event.target.value))} /></Field>
      <Field label="Billing Status"><select value={form.financial.billingStatus} onChange={event => setFinancial('billingStatus', event.target.value as EngagementInput['financial']['billingStatus'])}>{['Not Started','Partially Billed','Fully Billed','Collected','On Hold'].map(item => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Amount Billed"><input type="number" min="0" step="0.01" value={form.financial.amountBilled} onChange={event => setFinancial('amountBilled', Number(event.target.value))} /></Field>
      <Field label="Amount Collected"><input type="number" min="0" step="0.01" value={form.financial.amountCollected} onChange={event => setFinancial('amountCollected', Number(event.target.value))} /></Field>
      <Field label="Outstanding Amount"><input readOnly value={(form.financial.amountBilled - form.financial.amountCollected).toFixed(2)} /></Field>
    </div><div className="form-actions"><Link className="button secondary" to={id ? `/engagements/${id}` : '/engagements'}>Cancel</Link><button className="button primary" disabled={saving || (!clients.length && !id)}>{saving ? 'Saving…' : 'Save Engagement'}</button></div></form></>;
}
