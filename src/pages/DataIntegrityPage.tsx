import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../components/AppContext';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatCard, StatusBadge } from '../components/ui';
import { useAsyncData } from '../hooks/useAsyncData';
import { services } from '../services';
import { downloadText } from '../utils/download';

export function DataIntegrityPage(){
  const {revision,notifyDataChanged,showToast}=useAppContext(); const [showEmpty,setShowEmpty]=useState(false);
  const health=useAsyncData(()=>services.phase6.scanIntegration(),[revision]);
  const exportSnapshot=()=>{const snapshot=services.phase6.createRawRecoverySnapshot();downloadText(`afm-raw-recovery-${snapshot.createdAt.slice(0,10)}.json`,JSON.stringify(snapshot,null,2),'application/json');showToast('Raw recovery snapshot exported.');};
  const resetModule=(key:string)=>{if(!window.confirm(`Reset only ${key}? A recovery snapshot will be retained locally before removal.`))return;try{const snapshotKey=services.phase6.resetCorruptModule(key);notifyDataChanged();showToast(`Corrupt module reset. Recovery snapshot: ${snapshotKey}`);}catch(error){showToast(error instanceof Error?error.message:'Unable to reset module.','error');}};
  return <><PageHeader title="Data Integrity and Recovery" description="Cross-module schema, relationship, numbering, financial and lock-state verification." actions={<><button className="button secondary" onClick={exportSnapshot}>Export Raw Recovery Snapshot</button><button className="button primary" onClick={health.reload}>Run Integrity Check</button></>}/>
    {health.loading&&<LoadingState/>}{health.error&&<ErrorState message={health.error} onRetry={health.reload}/>} {health.data&&<>
      <section className="stats-grid"><StatCard label="Total Records" value={health.data.totalRecords}/><StatCard label="Healthy Modules" value={health.data.healthyModules}/><StatCard label="Empty Modules" value={health.data.emptyModules}/><StatCard label="Corrupt Modules" value={health.data.corruptModules}/><StatCard label="Integrity Errors" value={health.data.errorCount}/><StatCard label="Warnings" value={health.data.warningCount}/></section>
      <section className="panel"><div className="panel-header"><div><h2>Integrity findings</h2><p>Checked {new Date(health.data.checkedAt).toLocaleString()}. Errors should be resolved before restoring, issuing reports or final file lock.</p></div><StatusBadge value={health.data.errorCount?'Action Required':health.data.warningCount?'Review':'Healthy'}/></div>
        {health.data.issues.length?<div className="integrity-list">{health.data.issues.map((issue,index)=><article className={`integrity-item severity-${issue.severity.toLowerCase()}`} key={`${issue.code}:${issue.recordId}:${index}`}><div><span className="integrity-code">{issue.severity} · {issue.module}</span><strong>{issue.message}</strong><small>{issue.code}{issue.recordId?` · ${issue.recordId}`:''}</small></div><Link className="button small" to={issue.route}>Open</Link></article>)}</div>:<EmptyState title="No integration conflicts detected" description="Current module schemas, relationships, numbering, invoice balances, final/current flags and lock records are consistent."/>}
      </section>
      <section className="panel"><div className="panel-header"><div><h2>Module health</h2><p>Corrupt payloads can be reset individually only after exporting a raw recovery snapshot.</p></div><label className="checkbox-field"><input type="checkbox" checked={showEmpty} onChange={event=>setShowEmpty(event.target.checked)}/> Show empty modules</label></div>
        <div className="responsive-table"><table><thead><tr><th>Module</th><th>Storage Key</th><th>Records</th><th>State</th><th>Recovery</th></tr></thead><tbody>{health.data.moduleHealth.filter(item=>showEmpty||item.state!=='Empty').map(item=><tr key={item.storageKey}><td>{item.module}</td><td><code>{item.storageKey}</code></td><td>{item.recordCount}</td><td><StatusBadge value={item.state}/>{item.errors.length>0&&<small className="table-error">{item.errors[0]}</small>}</td><td>{item.state==='Corrupt'?<button className="button danger small" onClick={()=>resetModule(item.storageKey)}>Snapshot & Reset</button>:<span className="muted">No action</span>}</td></tr>)}</tbody></table></div>
      </section>
    </>}
  </>;
}
