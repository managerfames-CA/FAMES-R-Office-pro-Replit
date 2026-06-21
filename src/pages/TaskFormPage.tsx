import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { services } from '../services';
import { emptyTask } from '../constants/defaults';
import type { TaskInput } from '../services/TaskService';
import { useAppContext } from '../components/AppContext';
import { ErrorState, Field, LoadingState, PageHeader, ValidationSummary } from '../components/ui';
import { PRIORITIES } from '../constants/statuses';
import { ValidationError } from '../utils/errors';

export function TaskFormPage() {
  const { id } = useParams(); const [query] = useSearchParams(); const navigate = useNavigate(); const { notifyDataChanged, showToast } = useAppContext();
  const [form, setForm] = useState<TaskInput>({ ...emptyTask, engagementId: query.get('engagementId') ?? '', taskType: query.get('engagementId') ? 'Engagement' : 'Internal' });
  const [clients, setClients] = useState<Awaited<ReturnType<typeof services.clients.list>>>([]); const [engagements, setEngagements] = useState<Awaited<ReturnType<typeof services.engagements.list>>>([]); const [staff, setStaff] = useState<Awaited<ReturnType<typeof services.staff.list>>>([]); const [loading, setLoading] = useState(true); const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => { void (async () => { try { const [c, e, s] = await Promise.all([services.clients.list(), services.engagements.list(), services.staff.list()]); setClients(c); setEngagements(e); setStaff(s); if (id) { const item = await services.tasks.get(id); if (item) setForm(item); } } catch (error) { setErrors([error instanceof Error ? error.message : 'Unable to load task form.']); } finally { setLoading(false); } })(); }, [id]);
  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) { event.preventDefault(); setErrors([]); try { const saved = await services.tasks.save(form, services.settings.get().operatorName, id); notifyDataChanged(); showToast(id ? 'Task updated.' : 'Task created.'); navigate(`/tasks/${saved.id}`); } catch (error) { setErrors(error instanceof ValidationError ? error.details ?? [error.message] : [error instanceof Error ? error.message : 'Unable to save task.']); } }
  if (loading) return <LoadingState />;
  const linkedEngagement = engagements.find(item => item.id === form.engagementId);
  const readOnly = Boolean(id && linkedEngagement && ['Locked', 'Closed'].includes(linkedEngagement.status));
  if (readOnly) return <><PageHeader title="Read-only Task" description={`The linked engagement is ${linkedEngagement?.status}.`} actions={<Link className="button secondary" to={`/tasks/${id}`}>Back</Link>} /><ErrorState message="Tasks linked to Locked or Closed engagements cannot be edited." /></>;
  const taskStatuses = services.settings.get().statusSettings.filter(item => item.entity === 'Task' && (item.isActive || item.value === form.status)).map(item => item.value as TaskInput['status']);
  return <><PageHeader title={id ? 'Edit Task' : 'New Task'} description="Internal, client and engagement task management." actions={<Link className="button secondary" to={id ? `/tasks/${id}` : '/tasks'}>Cancel</Link>} /><form className="panel form-panel" onSubmit={submit}><ValidationSummary errors={errors} /><div className="form-grid">
    <Field label="Task Title" required><input value={form.title} onChange={event => set('title', event.target.value)} /></Field>
    <Field label="Task Type"><select value={form.taskType} onChange={event => set('taskType', event.target.value as TaskInput['taskType'])}><option>Internal</option><option>Client</option><option>Engagement</option></select></Field>
    <Field label="Client"><select value={form.clientId} onChange={event => set('clientId', event.target.value)}><option value="">Select</option>{clients.map(item => <option key={item.id} value={item.id}>{item.legalName}</option>)}</select></Field>
    <Field label="Engagement"><select value={form.engagementId} onChange={event => { const value = event.target.value; const engagement = engagements.find(item => item.id === value); setForm(current => ({ ...current, engagementId: value, clientId: engagement?.clientId ?? current.clientId })); }}><option value="">Select</option>{engagements.filter(item => !['Locked', 'Closed'].includes(item.status) || item.id === form.engagementId).map(item => <option key={item.id} value={item.id}>{item.engagementCode} · {item.engagementType}</option>)}</select></Field>
    <Field label="Assignee"><select value={form.assigneeId} onChange={event => set('assigneeId', event.target.value)}><option value="">Unassigned</option>{staff.filter(item => item.isActive).map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field>
    <Field label="Reviewer"><select value={form.reviewerId} onChange={event => set('reviewerId', event.target.value)}><option value="">None</option>{staff.filter(item => item.isActive).map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field>
    <Field label="Priority"><select value={form.priority} onChange={event => set('priority', event.target.value as TaskInput['priority'])}>{PRIORITIES.map(item => <option key={item}>{item}</option>)}</select></Field>
    <Field label="Estimated Hours"><input type="number" min="0" step="0.5" value={form.estimatedHours} onChange={event => set('estimatedHours', Number(event.target.value))} /></Field>
    <Field label="Start Date"><input type="date" value={form.startDate} onChange={event => set('startDate', event.target.value)} /></Field>
    <Field label="Due Date"><input type="date" value={form.dueDate} onChange={event => set('dueDate', event.target.value)} /></Field>
    <Field label="Status"><select value={form.status} onChange={event => set('status', event.target.value as TaskInput['status'])}>{taskStatuses.map(item => <option key={item}>{item}</option>)}</select></Field>
    <Field label="Completion Date"><input type="date" value={form.completionDate} onChange={event => set('completionDate', event.target.value)} /></Field>
    <Field label="Blocker Reason"><textarea value={form.blockerReason} onChange={event => set('blockerReason', event.target.value)} /></Field>
    <Field label="Description"><textarea value={form.description} onChange={event => set('description', event.target.value)} /></Field>
  </div><div className="form-actions"><Link className="button secondary" to={id ? `/tasks/${id}` : '/tasks'}>Cancel</Link><button className="button primary">Save Task</button></div></form></>;
}
