import { useState } from 'react';
import { services } from '../services';
import { useAppContext } from '../components/AppContext';
import { useAsyncData } from '../hooks/useAsyncData';
import type { MasterInput } from '../services/MasterDataService';
import type { MasterRecord } from '../types/models';
import { ConfirmButton, EmptyState, ErrorState, Field, LoadingState, PageHeader, StatusBadge, ValidationSummary } from '../components/ui';
import { ValidationError } from '../utils/errors';

export type MasterKind = 'services' | 'client-categories' | 'industries';
const config = {
  services: { title: 'Service Master', singular: 'Service', service: services.serviceMaster },
  'client-categories': { title: 'Client Category Master', singular: 'Client Category', service: services.categoryMaster },
  industries: { title: 'Industry Master', singular: 'Industry', service: services.industryMaster }
} as const;
const blank: MasterInput = { code: '', name: '', description: '', isActive: true, status: 'Active' };

export function MasterDataPage({ kind }: { kind: MasterKind }) {
  const current = config[kind]; const { revision, notifyDataChanged, showToast } = useAppContext(); const [form, setForm] = useState<MasterInput>(blank); const [editId, setEditId] = useState(''); const [errors, setErrors] = useState<string[]>([]);
  const data = useAsyncData(() => current.service.list(true), [kind, revision]);
  function edit(item: MasterRecord) { setEditId(item.id); setForm({ code: item.code, name: item.name, description: item.description, isActive: item.isActive, status: item.status }); }
  function reset() { setEditId(''); setForm(blank); setErrors([]); }
  async function submit(event: React.FormEvent) { event.preventDefault(); setErrors([]); try { await current.service.save(form, services.settings.get().operatorName, editId || undefined); notifyDataChanged(); showToast(`${current.singular} saved.`); reset(); } catch (error) { setErrors(error instanceof ValidationError ? error.details ?? [error.message] : [error instanceof Error ? error.message : `Unable to save ${current.singular}.`]); } }
  async function archive(id: string) { try { await current.service.archive(id, services.settings.get().operatorName); notifyDataChanged(); showToast(`${current.singular} archived.`); } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to archive record.', 'error'); } }
  return <><PageHeader title={current.title} description="Maintain reusable master data without hard-coding it into pages." /><section className="split-layout align-start"><form className="panel sticky-form" onSubmit={submit}><h2>{editId ? `Edit ${current.singular}` : `Add ${current.singular}`}</h2><ValidationSummary errors={errors} /><div className="form-grid single"><Field label="Code" required><input value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} /></Field><Field label="Name" required><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field><Field label="Description"><textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></Field><label className="checkbox-field"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked, status: event.target.checked ? 'Active' : 'Inactive' })} /> Active</label></div><div className="form-actions">{editId && <button type="button" className="button secondary" onClick={reset}>Cancel</button>}<button className="button primary">Save</button></div></form><div>{data.loading && <LoadingState />}{data.error && <ErrorState message={data.error} onRetry={data.reload} />}{!data.loading && !data.data?.length && <EmptyState title={`No ${current.title.toLowerCase()} records`} description="Add the first master record." />}{!!data.data?.length && <div className="card-list">{data.data.map(item => <article className="record-card" key={item.id}><div><h3>{item.name}</h3><p>{item.code} · {item.description || 'No description'}</p><StatusBadge value={item.isDeleted ? 'Archived' : item.isActive ? 'Active' : 'Inactive'} /></div><div className="row-actions"><button className="button small" onClick={() => edit(item)}>Edit</button>{!item.isDeleted && <ConfirmButton message={`Archive ${item.name}? Referenced records will block this action.`} onConfirm={() => void archive(item.id)}>Archive</ConfirmButton>}</div></article>)}</div>}</div></section></>;
}
