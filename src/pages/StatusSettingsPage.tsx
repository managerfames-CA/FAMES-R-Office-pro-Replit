import { useState } from 'react';
import { services } from '../services';
import type { AppSettings } from '../types/models';
import { PageHeader, StatusBadge } from '../components/ui';
import { useAppContext } from '../components/AppContext';

export function StatusSettingsPage() {
  const { showToast, notifyDataChanged } = useAppContext(); const [settings, setSettings] = useState<AppSettings>(() => services.settings.get());
  function toggle(index: number) { setSettings(current => ({ ...current, statusSettings: current.statusSettings.map((item, itemIndex) => itemIndex === index ? { ...item, isActive: !item.isActive } : item) })); }
  function save() { try { services.settings.save(settings); notifyDataChanged(); showToast('Status settings saved.'); } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to save status settings.', 'error'); } }
  return <><PageHeader title="Status Settings" description="Control which approved core statuses are available for new selections." actions={<button className="button primary" onClick={save}>Save Settings</button>} /><div className="dashboard-grid">{(['Client','Engagement','Task','Deadline'] as const).map(entity => <section className="panel" key={entity}><h2>{entity} Statuses</h2><div className="list-stack">{settings.statusSettings.map((item, index) => ({ item, index })).filter(({ item }) => item.entity === entity).map(({ item, index }) => <div className="list-row" key={`${item.entity}-${item.value}`}><div><strong>{item.value}</strong></div><button className="plain-button" onClick={() => toggle(index)}><StatusBadge value={item.isActive ? 'Active' : 'Inactive'} /></button></div>)}</div></section>)}</div></>;
}
