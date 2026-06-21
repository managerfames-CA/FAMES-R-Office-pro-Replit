import { useMemo, useState } from 'react';
import { services } from '../services';
import { useAppContext } from '../components/AppContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { emptyDeadline } from '../constants/defaults';
import type { DeadlineInput } from '../services/DeadlineService';
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, StatusBadge, ValidationSummary } from '../components/ui';
import { PRIORITIES } from '../constants/statuses';
import { formatDate } from '../utils/dates';
import { ValidationError } from '../utils/errors';

export function DeadlinesPage() {
  const { revision, notifyDataChanged, showToast } = useAppContext();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [mode, setMode] = useState<'all' | 'upcoming' | 'overdue'>('all');
  const [form, setForm] = useState<DeadlineInput>(emptyDeadline);
  const [editId, setEditId] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const data = useAsyncData(async () => ({ deadlines: await services.deadlines.list(), clients: await services.clients.list(), engagements: await services.engagements.list(), staff: await services.staff.list(true) }), [revision]);
  const upcomingDays = services.settings.get().upcomingDeadlineDays;
  const filtered = useMemo(() => (data.data?.deadlines ?? []).filter(item => mode === 'all' || (mode === 'upcoming' ? services.deadlines.isUpcoming(item, upcomingDays) : services.deadlines.isOverdue(item))).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [data.data, mode, upcomingDays]);
  function edit(id: string) { const item = data.data?.deadlines.find(d => d.id === id); if (item) { setEditId(id); setForm(item); window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  function reset() { setEditId(''); setForm(emptyDeadline); setErrors([]); }
  async function submit(event: React.FormEvent) { event.preventDefault(); setErrors([]); try { await services.deadlines.save(form, services.settings.get().operatorName, editId || undefined); notifyDataChanged(); showToast(editId ? 'Deadline updated.' : 'Deadline created.'); reset(); } catch (error) { setErrors(error instanceof ValidationError ? error.details ?? [error.message] : [error instanceof Error ? error.message : 'Unable to save deadline.']); } }
  const staffName = (id: string) => data.data?.staff.find(item => item.id === id)?.fullName ?? '—';
  const isReadOnly = (engagementId: string) => Boolean(engagementId && ['Locked', 'Closed'].includes(data.data?.engagements.find(item => item.id === engagementId)?.status ?? ''));
  const deadlineStatuses = services.settings.get().statusSettings.filter(item => item.entity === 'Deadline' && (item.isActive || item.value === form.status)).map(item => item.value as DeadlineInput['status']);
  return <><PageHeader title="Deadlines" description={`Upcoming window: ${upcomingDays} days. Overdue is calculated automatically.`} actions={<div className="segmented"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>Date Cards</button></div>} />
    <section className="split-layout align-start"><form className="panel sticky-form" onSubmit={submit}><h2>{editId ? 'Edit Deadline' : 'Add Deadline'}</h2><ValidationSummary errors={errors} /><div className="form-grid single">
      <Field label="Client"><select value={form.clientId} onChange={event => setForm({ ...form, clientId: event.target.value })}><option value="">None</option>{data.data?.clients.map(item => <option key={item.id} value={item.id}>{item.legalName}</option>)}</select></Field>
      <Field label="Engagement"><select value={form.engagementId} onChange={event => { const value = event.target.value; const engagement = data.data?.engagements.find(item => item.id === value); setForm({ ...form, engagementId: value, clientId: engagement?.clientId ?? form.clientId }); }}><option value="">None</option>{data.data?.engagements.filter(item => !['Locked', 'Closed'].includes(item.status) || item.id === form.engagementId).map(item => <option key={item.id} value={item.id}>{item.engagementCode}</option>)}</select></Field>
      <Field label="Deadline Type" required><input value={form.deadlineType} onChange={event => setForm({ ...form, deadlineType: event.target.value })} /></Field>
      <Field label="Description" required><input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></Field>
      <Field label="Due Date" required><input type="date" value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })} /></Field>
      <Field label="Owner"><select value={form.ownerId} onChange={event => setForm({ ...form, ownerId: event.target.value })}><option value="">Unassigned</option>{data.data?.staff.filter(item => item.isActive && !item.isDeleted).map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field>
      <Field label="Priority"><select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value as DeadlineInput['priority'] })}>{PRIORITIES.map(item => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Status"><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as DeadlineInput['status'] })}>{deadlineStatuses.map(item => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Completion Date"><input type="date" value={form.completionDate} onChange={event => setForm({ ...form, completionDate: event.target.value })} /></Field>
      <Field label="Change Reason" hint="Required when changing a Critical deadline due date."><textarea value={form.changeReason} onChange={event => setForm({ ...form, changeReason: event.target.value })} /></Field>
    </div><div className="form-actions">{editId && <button type="button" className="button secondary" onClick={reset}>Cancel</button>}<button className="button primary">{editId ? 'Update Deadline' : 'Add Deadline'}</button></div></form>
    <div><section className="filter-panel compact"><label>View<select value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="all">All</option><option value="upcoming">Upcoming</option><option value="overdue">Overdue</option></select></label></section>{data.loading && <LoadingState />}{data.error && <ErrorState message={data.error} onRetry={data.reload} />}{!data.loading && !filtered.length && <EmptyState title="No deadlines found" description="Add a deadline or adjust the view filter." />}
      {view === 'list' && !!filtered.length && <div className="card-list">{filtered.map(item => <article className="record-card" key={item.id}><div><h3>{item.description}</h3><p>{item.deadlineType} · {staffName(item.ownerId)} · Due {formatDate(item.dueDate)}</p><div className="badge-row"><StatusBadge value={services.deadlines.isOverdue(item) ? 'Overdue' : item.status} /><StatusBadge value={item.priority} /></div></div>{isReadOnly(item.engagementId) ? <span className="read-only-inline">Read-only</span> : <button className="button small" onClick={() => edit(item.id)}>Edit</button>}</article>)}</div>}
      {view === 'calendar' && !!filtered.length && <div className="calendar-grid">{filtered.map(item => <article key={item.id}><time>{formatDate(item.dueDate)}</time><strong>{item.description}</strong><span>{item.deadlineType}</span><StatusBadge value={services.deadlines.isOverdue(item) ? 'Overdue' : item.status} /></article>)}</div>}
    </div></section></>;
}
