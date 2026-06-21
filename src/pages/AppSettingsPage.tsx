import { useState } from 'react';
import { services } from '../services';
import { Field, PageHeader, ValidationSummary } from '../components/ui';
import { useAppContext } from '../components/AppContext';
import { ValidationError } from '../utils/errors';

export function AppSettingsPage() {
  const { showToast, notifyDataChanged } = useAppContext(); const [settings, setSettings] = useState(() => services.settings.get()); const [errors, setErrors] = useState<string[]>([]);
  function save(event: React.FormEvent) { event.preventDefault(); setErrors([]); try { services.settings.save(settings); notifyDataChanged(); showToast('App settings saved.'); } catch (error) { setErrors(error instanceof ValidationError ? error.details ?? [error.message] : [error instanceof Error ? error.message : 'Unable to save settings.']); } }
  return <><PageHeader title="App Settings" description="Local operating preferences for Complete Phase 5." /><form className="panel form-panel narrow" onSubmit={save}><ValidationSummary errors={errors} /><div className="form-grid single"><Field label="Operator Name" required hint="Recorded in activity history for each change."><input value={settings.operatorName} onChange={event => setSettings({ ...settings, operatorName: event.target.value })} /></Field><Field label="Upcoming Deadline Days" required><input type="number" min="1" max="365" value={settings.upcomingDeadlineDays} onChange={event => setSettings({ ...settings, upcomingDeadlineDays: Number(event.target.value) })} /></Field><Field label="Expense Receipt Threshold" required hint="A receipt reference is mandatory above this amount."><input type="number" min="0" step="0.01" value={settings.expenseReceiptThreshold} onChange={event => setSettings({ ...settings, expenseReceiptThreshold: Number(event.target.value) })} /></Field><Field label="Schema Version"><input readOnly value={settings.schemaVersion} /></Field><Field label="App Version"><input readOnly value={settings.appVersion} /></Field></div><button className="button primary">Save Settings</button></form></>;
}
