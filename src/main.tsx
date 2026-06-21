import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { bootstrapApplication } from './services/BootstrapService';
import { StartupRecovery } from './components/StartupRecovery';
import { services } from './services';
import { downloadText } from './utils/download';

export function renderStartupRecovery(root: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unexpected startup error';
  const onExport=()=>{const snapshot=services.phase6.createRawRecoverySnapshot();downloadText(`afm-startup-recovery-${snapshot.createdAt.slice(0,10)}.json`,JSON.stringify(snapshot,null,2),'application/json');};
  const onReset=()=>{if(!window.confirm('Reset startup settings and metadata after creating a local recovery snapshot? Operational module records will not be removed.'))return;services.phase6.resetStartupConfiguration();window.location.reload();};
  createRoot(root).render(<StartupRecovery message={message} onExport={onExport} onReset={onReset}/>);
}
async function start() { const root = document.getElementById('root'); if (!root) return; try { await bootstrapApplication(); createRoot(root).render(<StrictMode><App /></StrictMode>); } catch (error) { renderStartupRecovery(root, error); } }
void start();
