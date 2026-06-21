import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { GlobalSearch } from '../components/GlobalSearch';

const links = [
  ['Dashboard', '/'], ['Clients', '/clients'], ['Engagements', '/engagements'], ['Tasks', '/tasks'], ['Deadlines', '/deadlines'], ['Staff', '/staff'],
  ['Workload', '/workload'], ['Timesheets', '/timesheets'], ['Expenses', '/expenses'], ['Billing', '/billing'], ['Communications', '/communications'], ['Reports', '/reports'],
  ['Listed/PIE', '/workspaces/listed'], ['Tax', '/workspaces/tax'], ['VAT', '/workspaces/vat'], ['RJSC', '/workspaces/rjsc'], ['Accounting', '/workspaces/accounting'], ['Advisory', '/workspaces/advisory']
] as const;

const adminLinks = [
  ['Service Master', '/administration/services'], ['Client Category Master', '/administration/client-categories'], ['Industry Master', '/administration/industries'], ['Status Settings', '/administration/status-settings'], ['Numbering Settings', '/administration/numbering'], ['Data Integrity', '/administration/data-integrity'], ['Backup and Restore', '/administration/backup'], ['Activity Log', '/administration/activity'], ['App Settings', '/administration/app-settings']
] as const;

export function AppShell() {
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(true);
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumb = pathParts.length ? pathParts.map(part => part.replace(/-/g, ' ')).join(' / ') : 'Dashboard';
  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">AF</div><div><strong>Audit Firm</strong><span>Management</span></div></div>
      <nav aria-label="Main navigation">
        {links.map(([label, href]) => <NavLink key={href} to={href} end={href === '/'} onClick={() => setOpen(false)}>{label}</NavLink>)}
        <button className="nav-section" onClick={() => setAdminOpen(value => !value)} aria-expanded={adminOpen}>Administration <span>{adminOpen ? '−' : '+'}</span></button>
        {adminOpen && <div className="subnav">{adminLinks.map(([label, href]) => <NavLink key={href} to={href} onClick={() => setOpen(false)}>{label}</NavLink>)}</div>}
      </nav>
      <footer><span>Phase 6 · Integrated Local</span><small>No login · No cloud</small></footer>
    </aside>
    {open && <button className="backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <div className="main-column">
      <header className="topbar"><button className="menu-button" aria-label="Open navigation" onClick={() => setOpen(true)}>☰</button><div className="breadcrumbs">{breadcrumb}</div><GlobalSearch/><div className="local-chip">Local data</div></header>
      <main className="content"><Outlet /></main>
    </div>
  </div>;
}
