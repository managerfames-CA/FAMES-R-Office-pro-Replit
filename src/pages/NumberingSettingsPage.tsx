import { useState } from 'react';
import { services } from '../services';
import { Field, LoadingState, PageHeader, StatusBadge, ValidationSummary } from '../components/ui';
import { useAppContext } from '../components/AppContext';
import { ValidationError } from '../utils/errors';
import { useAsyncData } from '../hooks/useAsyncData';
import type { ReferencePrefixSettings } from '../types/models';

const labels:Record<keyof ReferencePrefixSettings,string>={reviewNote:'Review Note',finding:'Finding',invoice:'Invoice',documentRequest:'Document Request',amendment:'Amendment',collection:'Collection',followUp:'Follow-up',managementLetter:'Management Letter',representationLetter:'Representation Letter'};
export function NumberingSettingsPage() {
  const { showToast, notifyDataChanged, revision } = useAppContext(); const [settings, setSettings] = useState(() => services.settings.get()); const [errors, setErrors] = useState<string[]>([]);
  const health=useAsyncData(()=>services.phase6.numberingHealth(),[revision,settings.numbering.startingSequence,settings.numbering.numberPadding]);
  function save(event: React.FormEvent) { event.preventDefault(); setErrors([]); try { services.settings.save(settings); notifyDataChanged(); showToast('Numbering settings saved.'); } catch (error) { setErrors(error instanceof ValidationError ? error.details ?? [error.message] : [error instanceof Error ? error.message : 'Unable to save settings.']); } }
  const setPrefix=(key:keyof ReferencePrefixSettings,value:string)=>setSettings(current=>({...current,numbering:{...current.numbering,referencePrefixes:{...current.numbering.referencePrefixes,[key]:value}}}));
  return <><PageHeader title="Numbering Settings" description="Central prefixes and collision-safe sequence rules used across operational references." />
    <form className="panel form-panel" onSubmit={save}><ValidationSummary errors={errors} /><h2>Core master numbering</h2><div className="form-grid"><Field label="Client Code Prefix"><input value={settings.numbering.clientPrefix} onChange={event => setSettings({ ...settings, numbering: { ...settings.numbering, clientPrefix: event.target.value } })} /></Field><Field label="Engagement Code Prefix"><input value={settings.numbering.engagementPrefix} onChange={event => setSettings({ ...settings, numbering: { ...settings.numbering, engagementPrefix: event.target.value } })} /></Field><Field label="Starting Sequence"><input type="number" min="1" value={settings.numbering.startingSequence} onChange={event => setSettings({ ...settings, numbering: { ...settings.numbering, startingSequence: Number(event.target.value) } })} /></Field><Field label="Number Padding"><input type="number" min="1" max="10" value={settings.numbering.numberPadding} onChange={event => setSettings({ ...settings, numbering: { ...settings.numbering, numberPadding: Number(event.target.value) } })} /></Field></div>
    <h2>Operational reference prefixes</h2><div className="form-grid">{(Object.keys(labels) as Array<keyof ReferencePrefixSettings>).map(key=><Field label={`${labels[key]} Prefix`} key={key}><input value={settings.numbering.referencePrefixes[key]} onChange={event=>setPrefix(key,event.target.value)}/></Field>)}</div>
    <div className="form-actions"><button className="button primary">Save Numbering</button></div></form>
    <section className="panel"><div className="panel-header"><div><h2>Numbering health</h2><p>References are checked case-insensitively across active and historical repositories.</p></div>{health.loading?<span>Checking…</span>:<StatusBadge value={health.data?.duplicates.length?'Conflict':'Healthy'}/>}</div>{health.loading&&<LoadingState/>}{health.data&&<><div className="code-preview">{Object.entries(health.data.suggestions).map(([key,value])=><div key={key}><span>{key.replace(/([A-Z])/g,' $1')}</span><strong>{value}</strong></div>)}</div>{health.data.duplicates.length>0&&<ul className="validation-list">{health.data.duplicates.map((item,index)=><li key={`${item.recordId}:${index}`}>{item.message}</li>)}</ul>}</>}</section>
  </>;
}
