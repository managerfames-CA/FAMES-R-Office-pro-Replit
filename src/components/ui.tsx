import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">◇</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function LoadingState() { return <div className="loading-state" role="status"><span className="spinner" /> Loading…</div>; }

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="alert error"><strong>Unable to load data.</strong><span>{message}</span>{onRetry && <button className="button small" onClick={onRetry}>Retry</button>}</div>;
}

export function StatusBadge({ value }: { value: string }) {
  const tone = /active|approved|completed|issued|collected/i.test(value) ? 'success' : /rejected|cancelled|critical|blocked|overdue/i.test(value) ? 'danger' : /pending|review|progress|reporting|planning/i.test(value) ? 'warning' : 'neutral';
  return <span className={`badge ${tone}`}>{value}</span>;
}

export function ListedBadge() { return <span className="badge listed">Listed/PIE</span>; }

export function Field({ label, required, error, children, hint }: { label: string; required?: boolean; error?: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{children}{hint && <small>{hint}</small>}{error && <small className="field-error">{error}</small>}</label>;
}

export function ConfirmButton({ message, onConfirm, children, className = 'button danger small' }: { message: string; onConfirm: () => void; children: ReactNode; className?: string }) {
  return <button className={className} onClick={() => { if (window.confirm(message)) onConfirm(); }}>{children}</button>;
}

export function StatCard({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export function ValidationSummary({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return <div className="alert error" role="alert"><strong>Please correct the following:</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>;
}
