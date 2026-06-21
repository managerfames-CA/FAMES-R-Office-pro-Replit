import { useMemo, useState } from 'react';
import { services } from '../services';
import { useAppContext } from '../components/AppContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/ui';
import { formatDateTime } from '../utils/dates';

export function ActivityLogPage() {
  const { revision } = useAppContext(); const [entity, setEntity] = useState(''); const [action, setAction] = useState(''); const [search, setSearch] = useState('');
  const data = useAsyncData(() => services.activity.recent(1000), [revision]);
  const filtered = useMemo(() => (data.data ?? []).filter(item => (!entity || item.entityType === entity) && (!action || item.action === action) && (!search || `${item.changedFieldSummary} ${item.operatorName} ${item.reason}`.toLowerCase().includes(search.toLowerCase()))), [data.data, entity, action, search]);
  const entities = [...new Set((data.data ?? []).map(item => item.entityType))]; const actions = [...new Set((data.data ?? []).map(item => item.action))];
  return <><PageHeader title="Activity Log" description="Operational local activity log. It is not tamper-proof." /><section className="filter-panel"><label className="wide">Search<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Summary, operator or reason" /></label><label>Entity<select value={entity} onChange={event => setEntity(event.target.value)}><option value="">All</option>{entities.map(item => <option key={item}>{item}</option>)}</select></label><label>Action<select value={action} onChange={event => setAction(event.target.value)}><option value="">All</option>{actions.map(item => <option key={item}>{item}</option>)}</select></label></section>{data.loading && <LoadingState />}{data.error && <ErrorState message={data.error} onRetry={data.reload} />}{!data.loading && !filtered.length && <EmptyState title="No activity records" description="Create or update operational records to populate the log." />}{!!filtered.length && <div className="timeline panel">{filtered.map(item => <div key={item.id}><strong>{item.entityType} · {item.action}</strong><span>{item.changedFieldSummary}</span><div className="badge-row"><StatusBadge value={item.newStatus || item.action} /></div><small>{formatDateTime(item.occurredAt)} · {item.operatorName}{item.reason ? ` · ${item.reason}` : ''}</small></div>)}</div>}</>;
}
