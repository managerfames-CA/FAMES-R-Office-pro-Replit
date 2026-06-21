import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { services } from '../services';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAppContext } from '../components/AppContext';
import { EmptyState, ErrorState, ListedBadge, LoadingState, PageHeader, StatusBadge } from '../components/ui';
import { ENGAGEMENT_STATUSES, SERVICE_TYPES } from '../constants/statuses';
import { formatDate } from '../utils/dates';

export function EngagementsPage() {
  const { revision } = useAppContext();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const data = useAsyncData(async () => ({ engagements: await services.engagements.list(), clients: await services.clients.list(), staff: await services.staff.list() }), [revision]);
  const filtered = useMemo(() => (data.data?.engagements ?? []).filter(item => {
    const client = data.data?.clients.find(client => client.id === item.clientId);
    const text = `${item.engagementCode} ${item.engagementType} ${client?.legalName ?? ''}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!status || item.status === status) && (!service || item.serviceType === service);
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [data.data, search, status, service]);
  return <>
    <PageHeader title="Engagements" description="Create, assign and monitor firm engagements." actions={<Link className="button primary" to="/engagements/new">New Engagement</Link>} />
    <section className="filter-panel"><label className="wide">Search<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Code, client or type" /></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All</option>{ENGAGEMENT_STATUSES.map(item => <option key={item}>{item}</option>)}</select></label><label>Service<select value={service} onChange={event => setService(event.target.value)}><option value="">All</option>{SERVICE_TYPES.map(item => <option key={item}>{item}</option>)}</select></label></section>
    {data.loading && <LoadingState />}{data.error && <ErrorState message={data.error} onRetry={data.reload} />}
    {!data.loading && !filtered.length && <EmptyState title="No engagements found" description={data.data?.engagements.length ? 'Adjust the filters.' : 'Create the first engagement after activating a client and assigning staff.'} action={<Link className="button primary" to="/engagements/new">New Engagement</Link>} />}
    {!!filtered.length && <div className="table-wrap"><table><thead><tr><th>Engagement</th><th>Client</th><th>Service</th><th>Dates</th><th>Status</th><th>Priority</th><th>Actions</th></tr></thead><tbody>{filtered.map(item => { const client = data.data?.clients.find(c => c.id === item.clientId); return <tr key={item.id}><td><Link className="table-title" to={`/engagements/${item.id}`}>{item.engagementCode}</Link><span className="table-subtitle">{item.engagementType}</span>{item.listedPieWorkflowRequired && <ListedBadge />}</td><td>{client?.legalName ?? <span className="missing-ref">Missing client</span>}</td><td>{item.serviceType}</td><td><span className="table-subtitle">Start {formatDate(item.startDate)}</span><span className="table-subtitle">Target {formatDate(item.targetCompletionDate)}</span></td><td><StatusBadge value={item.status} /></td><td><StatusBadge value={item.priority} /></td><td><div className="row-actions"><Link className="button small" to={`/engagements/${item.id}`}>Workspace</Link>{!['Locked','Closed'].includes(item.status) && <Link className="button small" to={`/engagements/${item.id}/edit`}>Edit</Link>}</div></td></tr>; })}</tbody></table></div>}
  </>;
}
