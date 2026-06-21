import { useMemo, useState } from 'react';
import { services } from '../services';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAppContext } from '../components/AppContext';
import { emptyStaff } from '../constants/defaults';
import type { StaffInput } from '../services/StaffService';
import type { Staff } from '../types/models';
import { ErrorState, Field, LoadingState, PageHeader, StatusBadge, ValidationSummary, EmptyState } from '../components/ui';
import { STAFF_ROLES } from '../constants/statuses';
import { ValidationError } from '../utils/errors';

export function StaffPage() {
  const { revision, notifyDataChanged, showToast } = useAppContext();
  const [form, setForm] = useState<StaffInput>(emptyStaff);
  const [editId, setEditId] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const data = useAsyncData(() => services.staff.list(true), [revision]);
  const filtered = useMemo(() => (data.data ?? []).filter(item => (!search || `${item.staffCode} ${item.fullName} ${item.email}`.toLowerCase().includes(search.toLowerCase())) && (!role || item.role === role)), [data.data, search, role]);
  function edit(item: Staff) {
    setEditId(item.id);
    setForm({ staffCode: item.staffCode, fullName: item.fullName, role: item.role, designation: item.designation, email: item.email, phone: item.phone, weeklyCapacityHours: item.weeklyCapacityHours, joinDate: item.joinDate, isActive: item.isActive, status: item.status, notes: item.notes });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function reset() { setEditId(''); setForm(emptyStaff); setErrors([]); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setErrors([]);
    try { await services.staff.save(form, services.settings.get().operatorName, editId || undefined); notifyDataChanged(); showToast(editId ? 'Staff updated.' : 'Staff created.'); reset(); }
    catch (error) { setErrors(error instanceof ValidationError ? error.details ?? [error.message] : [error instanceof Error ? error.message : 'Unable to save staff.']); }
  }
  return <>
    <PageHeader title="Staff Master" description="Manage firm roles, capacity and active assignment eligibility." />
    <section className="split-layout align-start">
      <form className="panel sticky-form" onSubmit={submit}><h2>{editId ? 'Edit Staff' : 'Add Staff'}</h2><ValidationSummary errors={errors} /><div className="form-grid single">
        <Field label="Staff Code" required><input value={form.staffCode} onChange={event => setForm({ ...form, staffCode: event.target.value })} /></Field>
        <Field label="Full Name" required><input value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} /></Field>
        <Field label="Role"><select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as StaffInput['role'] })}>{STAFF_ROLES.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Designation"><input value={form.designation} onChange={event => setForm({ ...form, designation: event.target.value })} /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field>
        <Field label="Weekly Capacity Hours"><input type="number" min="0" max="168" value={form.weeklyCapacityHours} onChange={event => setForm({ ...form, weeklyCapacityHours: Number(event.target.value) })} /></Field>
        <Field label="Join Date"><input type="date" value={form.joinDate} onChange={event => setForm({ ...form, joinDate: event.target.value })} /></Field>
        <label className="checkbox-field"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked, status: event.target.checked ? 'Active' : 'Inactive' })} /> Active and assignable</label>
        <Field label="Notes"><textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></Field>
      </div><div className="form-actions">{editId && <button type="button" className="button secondary" onClick={reset}>Cancel</button>}<button className="button primary">{editId ? 'Update Staff' : 'Add Staff'}</button></div></form>
      <div><section className="filter-panel compact"><label className="wide">Search<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Code, name or email" /></label><label>Role<select value={role} onChange={event => setRole(event.target.value)}><option value="">All</option>{STAFF_ROLES.map(item => <option key={item}>{item}</option>)}</select></label></section>
      {data.loading && <LoadingState />}{data.error && <ErrorState message={data.error} onRetry={data.reload} />}{!data.loading && !filtered.length && <EmptyState title="No staff records" description="Add the Partner, Managers and other staff using their actual names." />}
      {!!filtered.length && <div className="card-list">{filtered.map(item => <article className="record-card" key={item.id}><div><h3>{item.fullName}</h3><p>{item.staffCode} · {item.role}</p><div className="badge-row"><StatusBadge value={item.isActive ? 'Active' : 'Inactive'} /><StatusBadge value={`${item.weeklyCapacityHours}h/week`} /></div></div><button className="button small" onClick={() => edit(item)}>Edit</button></article>)}</div>}</div>
    </section>
  </>;
}
