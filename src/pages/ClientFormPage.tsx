import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { services } from '../services';
import { emptyClient } from '../constants/defaults';
import type { ClientInput } from '../services/ClientService';
import { useAppContext } from '../components/AppContext';
import { Field, LoadingState, PageHeader, ValidationSummary } from '../components/ui';
import { RISK_RATINGS } from '../constants/statuses';
import { ValidationError } from '../utils/errors';

export function ClientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notifyDataChanged, showToast } = useAppContext();
  const [form, setForm] = useState<ClientInput>(emptyClient);
  const [staff, setStaff] = useState<Awaited<ReturnType<typeof services.staff.list>>>([]);
  const [industries, setIndustries] = useState<Awaited<ReturnType<typeof services.industryMaster.list>>>([]);
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof services.categoryMaster.list>>>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { void (async () => {
    try {
      const [staffRecords, industryRecords, categoryRecords, allClients] = await Promise.all([services.staff.list(), services.industryMaster.list(), services.categoryMaster.list(), services.clients.list(true)]);
      setStaff(staffRecords); setIndustries(industryRecords.filter(item => item.isActive)); setCategories(categoryRecords.filter(item => item.isActive));
      if (id) { const record = await services.clients.get(id); if (record) setForm(record); }
      else setForm({ ...emptyClient, clientCode: services.settings.generateNextCode('client', allClients.map(item => item.clientCode)) });
    } catch (error) { setErrors([error instanceof Error ? error.message : 'Unable to load form.']); }
    finally { setLoading(false); }
  })(); }, [id]);
  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setErrors([]);
    try {
      const operator = services.settings.get().operatorName;
      const saved = id ? await services.clients.update(id, form, operator) : await services.clients.create(form, operator);
      notifyDataChanged(); showToast(id ? 'Client updated.' : 'Client created.'); navigate(`/clients/${saved.id}`);
    } catch (error) { setErrors(error instanceof ValidationError ? error.details ?? [error.message] : [error instanceof Error ? error.message : 'Unable to save client.']); }
    finally { setSaving(false); }
  }
  if (loading) return <LoadingState />;
  const clientStatuses = services.settings.get().statusSettings.filter(item => item.entity === 'Client' && (item.isActive || item.value === form.status)).map(item => item.value as ClientInput['status']);
  return <>
    <PageHeader title={id ? 'Edit Client' : 'New Client'} description="Client master data and responsibility assignment." actions={<Link className="button secondary" to={id ? `/clients/${id}` : '/clients'}>Cancel</Link>} />
    <form className="panel form-panel" onSubmit={submit}>
      <ValidationSummary errors={errors} />
      <h2>Identity</h2><div className="form-grid">
        <Field label="Client Code" required><input value={form.clientCode} onChange={event => set('clientCode', event.target.value)} /></Field>
        <Field label="Legal Name" required><input value={form.legalName} onChange={event => set('legalName', event.target.value)} /></Field>
        <Field label="Trade Name"><input value={form.tradeName} onChange={event => set('tradeName', event.target.value)} /></Field>
        <Field label="Entity Type"><input value={form.entityType} onChange={event => set('entityType', event.target.value)} placeholder="Company, Partnership, NGO…" /></Field>
        <Field label="Industry"><select value={form.industryId} onChange={event => set('industryId', event.target.value)}><option value="">Select</option>{industries.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Client Category"><select value={form.clientCategoryId} onChange={event => set('clientCategoryId', event.target.value)}><option value="">Select</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Client Status"><select value={form.status} onChange={event => set('status', event.target.value as ClientInput['status'])}>{clientStatuses.map(item => <option key={item}>{item}</option>)}</select></Field>
        <label className="checkbox-card"><input type="checkbox" checked={form.isListedPie} onChange={event => set('isListedPie', event.target.checked)} /><span><strong>Listed/Public Interest Entity</strong><small>Clearly marks the client and activates the PIE workflow flag on engagements.</small></span></label>
      </div>
      <h2>Registration and tax</h2><div className="form-grid">
        <Field label="TIN"><input value={form.tin} onChange={event => set('tin', event.target.value)} /></Field>
        <Field label="BIN"><input value={form.bin} onChange={event => set('bin', event.target.value)} /></Field>
        <Field label="Registration Number"><input value={form.registrationNumber} onChange={event => set('registrationNumber', event.target.value)} /></Field>
        <Field label="Financial Year End"><input type="date" value={form.financialYearEnd} onChange={event => set('financialYearEnd', event.target.value)} /></Field>
      </div>
      <h2>Contact and address</h2><div className="form-grid">
        <Field label="Primary Phone"><input value={form.primaryPhone} onChange={event => set('primaryPhone', event.target.value)} /></Field>
        <Field label="Primary Email"><input type="email" value={form.primaryEmail} onChange={event => set('primaryEmail', event.target.value)} /></Field>
        <Field label="Website"><input value={form.website} onChange={event => set('website', event.target.value)} /></Field>
        <Field label="Registered Address"><textarea value={form.registeredAddress} onChange={event => set('registeredAddress', event.target.value)} /></Field>
        <Field label="Business Address"><textarea value={form.businessAddress} onChange={event => set('businessAddress', event.target.value)} /></Field>
      </div>
      <h2>Responsibility and risk</h2><div className="form-grid">
        <Field label="Responsible Partner"><select value={form.responsiblePartnerId} onChange={event => set('responsiblePartnerId', event.target.value)}><option value="">Select</option>{staff.filter(item => item.role === 'Partner' && item.isActive).map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field>
        <Field label="Responsible Manager"><select value={form.responsibleManagerId} onChange={event => set('responsibleManagerId', event.target.value)}><option value="">Select</option>{staff.filter(item => item.role === 'Manager' && item.isActive).map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field>
        <Field label="Risk Rating"><select value={form.riskRating} onChange={event => set('riskRating', event.target.value as ClientInput['riskRating'])}>{RISK_RATINGS.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Duplicate Override Reason" hint="Required only when a duplicate warning is detected."><textarea value={form.duplicateOverrideReason ?? ''} onChange={event => set('duplicateOverrideReason', event.target.value)} /></Field>
        <Field label="Notes"><textarea value={form.notes} onChange={event => set('notes', event.target.value)} /></Field>
      </div>
      <div className="form-actions"><Link className="button secondary" to={id ? `/clients/${id}` : '/clients'}>Cancel</Link><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save Client'}</button></div>
    </form>
  </>;
}
