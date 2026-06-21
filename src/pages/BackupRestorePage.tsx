import { useState } from 'react';
import { services } from '../services';
import type { BackupEnvelope, RestorePreview, RestoreResult } from '../types/models';
import type { RestoreMode } from '../services/BackupService';
import { downloadText } from '../utils/download';
import { BACKUP_DATA_KEYS } from '../utils/backupValidation';
import { PageHeader, ValidationSummary, StatusBadge } from '../components/ui';
import { useAppContext } from '../components/AppContext';

export function BackupRestorePage() {
  const { notifyDataChanged, showToast } = useAppContext();
  const [backup, setBackup] = useState<BackupEnvelope | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [errors, setErrors] = useState<string[]>([]);

  async function exportBackup(moduleKey?: string) {
    try {
      const envelope = services.backup.createBackup(moduleKey);
      const suffix = moduleKey ? moduleKey.replace('afm:', '') : 'full';
      downloadText(`afm-backup-${suffix}-${envelope.backupDate.slice(0, 10)}.json`, JSON.stringify(envelope, null, 2), 'application/json');
      await services.activity.log({ entityType: 'Backup', entityId: envelope.backupDate, action: 'Backup Export', changedFieldSummary: envelope.integritySummary, operatorName: services.settings.get().operatorName, reason: moduleKey ? `Module export: ${moduleKey}` : 'Full export' });
      notifyDataChanged();
      showToast('Backup exported.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Backup export failed.', 'error'); }
  }

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    setErrors([]); setResult(null);
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = services.backup.parse(await file.text());
      const nextPreview = services.backup.preview(parsed, mode);
      setBackup(parsed); setPreview(nextPreview); setErrors(nextPreview.errors);
    } catch (error) {
      setBackup(null); setPreview(null); setErrors([error instanceof Error ? error.message : 'Invalid backup file.']);
    }
  }

  function changeMode(nextMode: RestoreMode) {
    setMode(nextMode);
    if (backup) {
      const nextPreview = services.backup.preview(backup, nextMode);
      setPreview(nextPreview); setErrors(nextPreview.errors);
    }
  }

  async function restore() {
    if (!backup || !preview?.valid) return;
    if (!window.confirm(`${mode === 'replace' ? 'Replace all matching module data' : 'Merge new records'} using this backup? A verified pre-import backup will be created.`)) return;
    try {
      const nextResult = await services.backup.restore(backup, mode, services.settings.get().operatorName);
      setResult(nextResult); notifyDataChanged();
      showToast(nextResult.rolledBack ? `Restore failed and rollback ${nextResult.rollbackSuccessful ? 'completed' : 'reported errors'}.` : 'Restore completed.', nextResult.rolledBack ? 'error' : 'success');
    } catch (error) {
      const details = error && typeof error === 'object' && 'details' in error ? (error as { details?: string[] }).details ?? [] : [];
      setErrors(details.length ? details : [error instanceof Error ? error.message : 'Restore failed.']);
    }
  }

  return <>
    <PageHeader title="Backup and Restore" description="Runtime-validated, relationship-aware and atomic JSON restore workflows." actions={<button className="button primary" onClick={() => void exportBackup()}>Export Full Backup</button>} />
    <section className="dashboard-grid">
      <article className="panel"><h2>Full JSON Export</h2><p>Exports every required Phase 1, Phase 2 and Phase 3 module, settings and metadata with a complete-payload checksum.</p><button className="button primary" onClick={() => void exportBackup()}>Download Full JSON</button></article>
      <article className="panel"><h2>Per-module Export</h2><div className="button-grid">{BACKUP_DATA_KEYS.map(key => <button className="button secondary small" key={key} onClick={() => void exportBackup(key)}>{key.replace('afm:', '').replaceAll('_', ' ')}</button>)}</div></article>
    </section>
    <section className="panel"><h2>Import and Restore</h2><ValidationSummary errors={errors} />
      <label className="file-drop"><input aria-label="Backup JSON file" type="file" accept="application/json,.json" onChange={event => void chooseFile(event)} /><strong>Select a JSON backup file</strong><span>No data changes until the complete schema, checksum and relationships pass validation.</span></label>
      {preview && <div className="restore-preview"><div className="panel-header"><h3>Import Preview</h3><StatusBadge value={preview.valid ? 'Valid' : 'Invalid'} /></div>
        <div className="summary-bars">{Object.entries(preview.moduleCounts).map(([key, count]) => <div key={key}><span>{key}</span><strong>{count}</strong></div>)}</div>
        <dl className="detail-grid"><dt>Backup type</dt><dd>{backup?.backupType ?? 'Unknown'}</dd><dt>Checksum</dt><dd>{preview.checksumMatches ? 'Matches' : 'Mismatch'}</dd><dt>Conflicts</dt><dd>{preview.conflicts.length}</dd><dt>Warnings</dt><dd>{preview.warnings.join(' ') || 'None'}</dd></dl>
        {preview.conflicts.length > 0 && <div className="conflict-list"><h4>Duplicate Conflict Report</h4>{preview.conflicts.slice(0, 20).map((conflict, index) => <p key={`${conflict.module}-${conflict.recordId}-${index}`}>{conflict.module} · {conflict.recordId} · {conflict.reason}</p>)}</div>}
        <div className="restore-controls"><label><input type="radio" checked={mode === 'merge'} onChange={() => changeMode('merge')} /> Merge Mode <small>Existing IDs remain unchanged.</small></label><label><input type="radio" checked={mode === 'replace'} onChange={() => changeMode('replace')} /> Replace-All Mode <small>Included modules are atomically replaced.</small></label><button className="button danger" disabled={!preview.valid} onClick={() => void restore()}>Run Restore</button></div>
      </div>}
      {result && <div className={`alert ${result.rolledBack ? (result.rollbackSuccessful ? 'warning' : 'error') : 'success'}`}><strong>{result.rolledBack ? 'Restore rolled back' : 'Restore committed'}</strong><span>{result.successCount} successful · {result.failureCount} failed · {result.conflictCount} conflicts</span><span>Pre-import snapshot: {result.preImportBackupKey}</span>{result.rolledBack && <span>Rollback verification: {result.rollbackSuccessful ? 'Successful' : 'Failed — review details'}</span>}{result.failures.length > 0 && <ul>{result.failures.map(item => <li key={item}>{item}</li>)}</ul>}</div>}
    </section>
  </>;
}
