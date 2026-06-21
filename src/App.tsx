import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from './components/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './layouts/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientFormPage } from './pages/ClientFormPage';
import { ClientProfilePage } from './pages/ClientProfilePage';
import { StaffPage } from './pages/StaffPage';
import { EngagementsPage } from './pages/EngagementsPage';
import { EngagementFormPage } from './pages/EngagementFormPage';
import { EngagementWorkspacePage } from './pages/EngagementWorkspacePage';
import { TasksPage } from './pages/TasksPage';
import { TaskFormPage } from './pages/TaskFormPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { DeadlinesPage } from './pages/DeadlinesPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { StatusSettingsPage } from './pages/StatusSettingsPage';
import { NumberingSettingsPage } from './pages/NumberingSettingsPage';
import { BackupRestorePage } from './pages/BackupRestorePage';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { AppSettingsPage } from './pages/AppSettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { DataIntegrityPage } from './pages/DataIntegrityPage';
import { AuditPlanningPage } from './features/auditPlanning/AuditPlanningPage';
import { Phase4DirectoryPage, Phase4WorkspacePage } from './features/phase4/Phase4Pages';
import { BillingPage, CommunicationsPage, ExpensesPage, ReportsPage, TimesheetsPage, WorkloadPage } from './features/phase5/Phase5Pages';

export default function App() {
  return <ErrorBoundary><AppProvider><HashRouter><Routes><Route element={<AppShell />}>
    <Route index element={<DashboardPage />} />
    <Route path="clients" element={<ClientsPage />} />
    <Route path="clients/new" element={<ClientFormPage />} />
    <Route path="clients/:id" element={<ClientProfilePage />} />
    <Route path="clients/:id/edit" element={<ClientFormPage />} />
    <Route path="staff" element={<StaffPage />} />
    <Route path="engagements" element={<EngagementsPage />} />
    <Route path="engagements/new" element={<EngagementFormPage />} />
    <Route path="engagements/:id" element={<EngagementWorkspacePage />} />
    <Route path="engagements/:id/edit" element={<EngagementFormPage />} />
    <Route path="engagements/:id/audit-planning/:section?" element={<AuditPlanningPage />} />
    <Route path="engagements/:id/phase4/:section?" element={<Phase4WorkspacePage />} />
    <Route path="workspaces/:service" element={<Phase4DirectoryPage />} />
    <Route path="tasks" element={<TasksPage />} />
    <Route path="tasks/new" element={<TaskFormPage />} />
    <Route path="tasks/:id" element={<TaskDetailPage />} />
    <Route path="tasks/:id/edit" element={<TaskFormPage />} />
    <Route path="deadlines" element={<DeadlinesPage />} />
    <Route path="workload" element={<WorkloadPage />} />
    <Route path="timesheets" element={<TimesheetsPage />} />
    <Route path="expenses" element={<ExpensesPage />} />
    <Route path="billing" element={<BillingPage />} />
    <Route path="communications" element={<CommunicationsPage />} />
    <Route path="reports" element={<ReportsPage />} />
    <Route path="administration/services" element={<MasterDataPage kind="services" />} />
    <Route path="administration/client-categories" element={<MasterDataPage kind="client-categories" />} />
    <Route path="administration/industries" element={<MasterDataPage kind="industries" />} />
    <Route path="administration/status-settings" element={<StatusSettingsPage />} />
    <Route path="administration/numbering" element={<NumberingSettingsPage />} />
    <Route path="administration/backup" element={<BackupRestorePage />} />
    <Route path="administration/activity" element={<ActivityLogPage />} />
    <Route path="administration/app-settings" element={<AppSettingsPage />} />
    <Route path="administration/data-integrity" element={<DataIntegrityPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route></Routes></HashRouter></AppProvider></ErrorBoundary>;
}
