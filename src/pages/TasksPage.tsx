import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { services } from '../services';
import { useAppContext } from '../components/AppContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/ui';
import { TASK_STATUSES, TASK_TRANSITIONS } from '../constants/statuses';
import { formatDate, todayIso } from '../utils/dates';
import type { Task, TaskStatus } from '../types/models';

export function TasksPage() {
  const { revision, notifyDataChanged, showToast } = useAppContext();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [movingId, setMovingId] = useState('');
  const data = useAsyncData(async () => ({ tasks: await services.tasks.list(), staff: await services.staff.list(true), clients: await services.clients.list(true), engagements: await services.engagements.list(true) }), [revision]);
  const filtered = useMemo(() => (data.data?.tasks ?? []).filter(task => (!search || task.title.toLowerCase().includes(search.toLowerCase())) && (!assigneeId || task.assigneeId === assigneeId)), [data.data, search, assigneeId]);
  const staffName = (id: string) => data.data?.staff.find(item => item.id === id)?.fullName ?? 'Unassigned';
  const contextName = (task: Task) => task.engagementId ? data.data?.engagements.find(item => item.id === task.engagementId)?.engagementCode ?? 'Missing engagement' : task.clientId ? data.data?.clients.find(item => item.id === task.clientId)?.legalName ?? 'Missing client' : 'Internal';
  const isReadOnly = (task: Task) => Boolean(task.engagementId && ['Locked', 'Closed'].includes(data.data?.engagements.find(item => item.id === task.engagementId)?.status ?? ''));

  async function moveTask(task: Task, status: TaskStatus): Promise<void> {
    if (status === task.status) return;
    let blockerReason = task.blockerReason;
    let completionDate = task.completionDate;
    if (status === 'Blocked') {
      blockerReason = window.prompt('Enter blocker reason:')?.trim() ?? '';
      if (!blockerReason) { showToast('Blocked status requires a blocker reason.', 'error'); return; }
    }
    if (status === 'Completed') completionDate = window.prompt('Completion date (YYYY-MM-DD):', todayIso())?.trim() ?? '';
    try {
      setMovingId(task.id);
      await services.tasks.changeStatus(task.id, status, services.settings.get().operatorName, { blockerReason, completionDate });
      notifyDataChanged();
      showToast(`Task moved to ${status}.`);
    } catch (error) {
      const details = error && typeof error === 'object' && 'details' in error ? (error as { details?: string[] }).details?.join(' ') : '';
      showToast(details || (error instanceof Error ? error.message : 'Task movement failed.'), 'error');
    } finally { setMovingId(''); }
  }

  return <>
    <PageHeader title="Tasks" description="Board and list views with validated status movement and calculated overdue status." actions={<div className="segmented"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>Board</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button><Link className="button primary" to="/tasks/new">New Task</Link></div>} />
    <section className="filter-panel"><label className="wide">Search<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Task title" /></label><label>Assignee<select value={assigneeId} onChange={event => setAssigneeId(event.target.value)}><option value="">All</option>{data.data?.staff.map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label></section>
    {data.loading && <LoadingState />}{data.error && <ErrorState message={data.error} onRetry={data.reload} />}
    {!data.loading && !filtered.length && <EmptyState title="No tasks found" description={data.data?.tasks.length ? 'Adjust the filters.' : 'Create the first internal, client or engagement task.'} action={<Link className="button primary" to="/tasks/new">New Task</Link>} />}
    {view === 'board' && !!filtered.length && <div className="kanban">{TASK_STATUSES.map(status => <section className="kanban-column" key={status}><header><strong>{status}</strong><span>{filtered.filter(item => item.status === status).length}</span></header><div>{filtered.filter(item => item.status === status).map(item => <article className="task-card" key={item.id}><Link to={`/tasks/${item.id}`}><strong>{item.title}</strong><span>{contextName(item)}</span><span>{staffName(item.assigneeId)}</span></Link><footer><small>{formatDate(item.dueDate)}</small><StatusBadge value={services.tasks.isOverdue(item) ? 'Overdue' : item.priority} /></footer>{isReadOnly(item) ? <div className="read-only-inline">Read-only · engagement {data.data?.engagements.find(engagement => engagement.id === item.engagementId)?.status}</div> : <label className="task-move">Move<select aria-label={`Move ${item.title}`} disabled={movingId === item.id || TASK_TRANSITIONS[item.status].length === 0} value={item.status} onChange={event => void moveTask(item, event.target.value as TaskStatus)}><option value={item.status}>{item.status}</option>{TASK_TRANSITIONS[item.status].map(next => <option key={next} value={next}>{next}</option>)}</select></label>}</article>)}</div></section>)}</div>}
    {view === 'list' && !!filtered.length && <div className="table-wrap"><table><thead><tr><th>Task</th><th>Context</th><th>Assignee</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><Link className="table-title" to={`/tasks/${item.id}`}>{item.title}</Link><span className="table-subtitle">{item.taskType}</span></td><td>{contextName(item)}</td><td>{staffName(item.assigneeId)}</td><td>{formatDate(item.dueDate)}</td><td><StatusBadge value={services.tasks.isOverdue(item) ? 'Overdue' : item.status} /></td><td>{isReadOnly(item) ? <span className="read-only-inline">Read-only</span> : <Link className="button small" to={`/tasks/${item.id}/edit`}>Edit</Link>}</td></tr>)}</tbody></table></div>}
  </>;
}
