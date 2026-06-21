import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { services } from '../services';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAppContext } from '../components/AppContext';
import { ConfirmButton, EmptyState, ErrorState, ListedBadge, LoadingState, PageHeader, StatusBadge } from '../components/ui';
import { downloadText, toCsv } from '../utils/download';

export function ClientsPage() {
  const { revision, notifyDataChanged, showToast } = useAppContext();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [managerId, setManagerId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [sort, setSort] = useState<'name' | 'code' | 'updated'>('name');
  const [page, setPage] = useState(1);
  const [includeArchived, setIncludeArchived] = useState(false);
  const pageSize = 10;
  const data = useAsyncData(async () => ({ clients: await services.clients.list(includeArchived), staff: await services.staff.list() }), [revision, includeArchived]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return [...(data.data?.clients ?? [])].filter(client => {
      const matchesSearch = !query || [client.clientCode, client.legalName, client.tradeName, client.tin, client.bin].some(value => value.toLocaleLowerCase().includes(query));
      return matchesSearch && (!status || client.status === status) && (!managerId || client.responsibleManagerId === managerId) && (!entityType || client.entityType === entityType);
    }).sort((a, b) => sort === 'code' ? a.clientCode.localeCompare(b.clientCode) : sort === 'updated' ? b.updatedAt.localeCompare(a.updatedAt) : a.legalName.localeCompare(b.legalName));
  }, [data.data, search, status, managerId, entityType, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((Math.min(page, pages) - 1) * pageSize, Math.min(page, pages) * pageSize);
  const managers = data.data?.staff.filter(item => item.role === 'Manager') ?? [];
  const entityTypes = [...new Set((data.data?.clients ?? []).map(item => item.entityType).filter(Boolean))];
  const exportRows = filtered.map(({ id, clientCode, legalName, tradeName, entityType, status, isListedPie, tin, bin, registrationNumber, primaryPhone, primaryEmail }) => ({ id, clientCode, legalName, tradeName, entityType, status, isListedPie, tin, bin, registrationNumber, primaryPhone, primaryEmail }));
  async function archive(id: string) {
    try { await services.clients.archive(id, services.settings.get().operatorName); notifyDataChanged(); showToast('Client archived.'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Unable to archive client.', 'error'); }
  }
  async function restore(id: string) {
    try { await services.clients.restore(id, services.settings.get().operatorName); notifyDataChanged(); showToast('Client restored.'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Unable to restore client.', 'error'); }
  }
  return <>
    <PageHeader title="Clients" description="Manage client master records, ownership and status." actions={<Link className="button primary" to="/clients/new">New Client</Link>} />
    <section className="filter-panel">
      <label className="wide">Search<input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Code, name, TIN or BIN" /></label>
      <label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All</option>{['Draft','Pending Acceptance','Active','Suspended','Inactive','Rejected'].map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Manager<select value={managerId} onChange={event => setManagerId(event.target.value)}><option value="">All</option>{managers.map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
      <label>Client Type<select value={entityType} onChange={event => setEntityType(event.target.value)}><option value="">All</option>{entityTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="name">Legal name</option><option value="code">Client code</option><option value="updated">Recently updated</option></select></label>
      <label className="checkbox-field"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} /> Include archived</label>
      <button className="button secondary" disabled={!filtered.length} onClick={() => downloadText('clients.json', JSON.stringify(exportRows, null, 2), 'application/json')}>Export JSON</button>
      <button className="button secondary" disabled={!filtered.length} onClick={() => downloadText('clients.csv', toCsv(exportRows), 'text/csv')}>Export CSV</button>
    </section>
    {data.loading && <LoadingState />}{data.error && <ErrorState message={data.error} onRetry={data.reload} />}
    {!data.loading && !data.error && !visible.length && <EmptyState title="No clients found" description={data.data?.clients.length ? 'Adjust the search or filters.' : 'Create the first client record to begin.'} action={<Link className="button primary" to="/clients/new">New Client</Link>} />}
    {!!visible.length && <>
      <div className="table-wrap"><table><thead><tr><th>Client</th><th>Type</th><th>Status</th><th>Manager</th><th>Risk</th><th>Actions</th></tr></thead><tbody>{visible.map(client => <tr key={client.id} className={client.isDeleted ? 'archived-row' : ''}><td><Link className="table-title" to={`/clients/${client.id}`}>{client.legalName}</Link><span className="table-subtitle">{client.clientCode} {client.tradeName && `· ${client.tradeName}`}</span>{client.isListedPie && <ListedBadge />}</td><td>{client.entityType || '—'}</td><td><StatusBadge value={client.isDeleted ? 'Archived' : client.status} /></td><td>{managers.find(item => item.id === client.responsibleManagerId)?.fullName ?? '—'}</td><td><StatusBadge value={client.riskRating} /></td><td><div className="row-actions"><Link className="button small" to={`/clients/${client.id}/edit`}>Edit</Link>{!client.isDeleted ? <ConfirmButton message="Archive this client? Historical links will be preserved." onConfirm={() => void archive(client.id)}>Archive</ConfirmButton> : <ConfirmButton className="button primary small" message="Restore this archived client?" onConfirm={() => void restore(client.id)}>Restore</ConfirmButton>}</div></td></tr>)}</tbody></table></div>
      <div className="pagination"><span>{filtered.length} record(s)</span><div><button className="button small" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {Math.min(page, pages)} of {pages}</span><button className="button small" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
    </>}
  </>;
}
