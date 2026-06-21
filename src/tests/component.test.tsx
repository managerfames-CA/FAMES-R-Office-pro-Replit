import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../components/AppContext';
import { StartupRecovery } from '../components/StartupRecovery';
import { AppShell } from '../layouts/AppShell';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ClientFormPage } from '../pages/ClientFormPage';
import { ClientProfilePage } from '../pages/ClientProfilePage';
import { EngagementFormPage } from '../pages/EngagementFormPage';
import { EngagementWorkspacePage } from '../pages/EngagementWorkspacePage';
import { TasksPage } from '../pages/TasksPage';
import { DashboardPage } from '../pages/DashboardPage';
import { BackupRestorePage } from '../pages/BackupRestorePage';
import { ClientsPage } from '../pages/ClientsPage';
import { EngagementsPage } from '../pages/EngagementsPage';
import { DeadlinesPage } from '../pages/DeadlinesPage';
import { StaffPage } from '../pages/StaffPage';
import { ActivityLogPage } from '../pages/ActivityLogPage';
import { AuditPlanningPage } from '../features/auditPlanning/AuditPlanningPage';
import { services } from '../services';
import { repositories } from '../repositories';
import { emptyAcceptance, emptyClient, emptyContact, emptyEngagement, emptyIndependence, emptyStaff, emptyTask } from '../constants/defaults';
import type { Engagement } from '../types/models';

function renderPage(ui: React.ReactNode, path = '/') {
  return render(<AppProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></AppProvider>);
}

async function seedUiEngagement(status: Engagement['status'] = 'Draft') {
  const client = await services.clients.create({ ...emptyClient, clientCode: 'CL-UI', legalName: 'UI Client', status: 'Active', entityType: 'Company' }, 'Tester');
  const partner = await services.staff.save({ ...emptyStaff, staffCode: 'P-UI', fullName: 'UI Partner', role: 'Partner' }, 'Tester');
  const manager = await services.staff.save({ ...emptyStaff, staffCode: 'M-UI', fullName: 'UI Manager', role: 'Manager' }, 'Tester');
  const engagement = await services.engagements.create({ ...emptyEngagement, engagementCode: 'ENG-UI', clientId: client.id, engagementType: 'Statutory Audit', serviceType: 'Audit', responsiblePartnerId: partner.id, responsibleManagerId: manager.id, financialPeriodStart: '2025-01-01', financialPeriodEnd: '2025-12-31' }, 'Tester');
  if (status !== 'Draft') {
    const changed = { ...engagement, status, recordVersion: engagement.recordVersion + 1 };
    await repositories.engagements.update(changed);
    return { client, partner, manager, engagement: changed };
  }
  return { client, partner, manager, engagement };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => cleanup());

describe('Main route component smoke checks', () => {
  it.each([
    ['Dashboard', <DashboardPage />],
    ['Clients', <ClientsPage />],
    ['Engagements', <EngagementsPage />],
    ['Tasks', <TasksPage />],
    ['Deadlines', <DeadlinesPage />],
    ['Staff Master', <StaffPage />],
    ['Backup and Restore', <BackupRestorePage />],
    ['Activity Log', <ActivityLogPage />]
  ])('renders the %s route without a crash', async (heading, page) => {
    renderPage(page);
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
  });
});

describe('React component interaction', () => {
  it('renders startup error text safely without creating executable markup', () => {
    const attack = '<img src=x onerror=alert(1)><script>window.pwned=true</script>';
    const { container } = render(<StartupRecovery message={attack} />);
    expect(screen.getByTestId('startup-error')).toHaveTextContent(attack);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: /reload application/i })).toBeVisible();
  });

  it('opens and closes mobile navigation and renders the not-found route', async () => {
    const user = userEvent.setup();
    const { container } = renderPage(<Routes><Route element={<AppShell />}><Route path="*" element={<NotFoundPage />} /></Route></Routes>, '/missing');
    await user.click(screen.getByRole('button', { name: /open navigation/i }));
    expect(container.querySelector('.sidebar')).toHaveClass('open');
    await user.click(screen.getByRole('button', { name: /close navigation/i }));
    expect(container.querySelector('.sidebar')).not.toHaveClass('open');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeVisible();
  });

  it('submits the client form and persists the client through the service layer', async () => {
    const user = userEvent.setup();
    renderPage(<Routes><Route path="/clients/new" element={<ClientFormPage />} /><Route path="/clients/:id" element={<div>Client saved</div>} /></Routes>, '/clients/new');
    await screen.findByRole('heading', { name: 'New Client' });
    await user.clear(screen.getByLabelText(/client code/i));
    await user.type(screen.getByLabelText(/client code/i), 'CL-100');
    await user.type(screen.getByLabelText(/legal name/i), 'Interaction Client Limited');
    await user.selectOptions(screen.getByLabelText(/client status/i), 'Active');
    await user.click(screen.getByRole('button', { name: /save client/i }));
    expect(await screen.findByText('Client saved')).toBeVisible();
    expect((await services.clients.list())[0].legalName).toBe('Interaction Client Limited');
  });

  it('creates contacts and reassigns primary contact through the client profile', async () => {
    const user = userEvent.setup();
    const client = await services.clients.create({ ...emptyClient, clientCode: 'CL-C', legalName: 'Contact Client', status: 'Active' }, 'Tester');
    renderPage(<Routes><Route path="/clients/:id" element={<ClientProfilePage />} /></Routes>, `/clients/${client.id}`);
    await screen.findByRole('heading', { name: 'Contact Client' });
    await user.click(screen.getByRole('button', { name: 'Contacts' }));
    await user.type(screen.getByLabelText(/^name/i), 'First Contact');
    await user.click(screen.getByLabelText(/primary contact/i));
    await user.click(screen.getByRole('button', { name: /add contact/i }));
    await screen.findByText('First Contact');
    await user.type(screen.getByLabelText(/^name/i), 'Second Contact');
    await user.click(screen.getByLabelText(/primary contact/i));
    await user.click(screen.getByRole('button', { name: /add contact/i }));
    await screen.findByText('Second Contact');
    const contacts = await services.clientContacts.forClient(client.id, true);
    expect(contacts.filter(item => item.isPrimary)).toHaveLength(1);
    expect(contacts.find(item => item.name === 'Second Contact')?.isPrimary).toBe(true);
  });

  it('submits an engagement form using active Partner and Manager records', async () => {
    const user = userEvent.setup();
    const client = await services.clients.create({ ...emptyClient, clientCode: 'CL-E', legalName: 'Engagement Client', status: 'Active' }, 'Tester');
    const partner = await services.staff.save({ ...emptyStaff, staffCode: 'P-E', fullName: 'Partner E', role: 'Partner' }, 'Tester');
    const manager = await services.staff.save({ ...emptyStaff, staffCode: 'M-E', fullName: 'Manager E', role: 'Manager' }, 'Tester');
    renderPage(<Routes><Route path="/engagements/new" element={<EngagementFormPage />} /><Route path="/engagements/:id" element={<div>Engagement saved</div>} /></Routes>, '/engagements/new');
    await screen.findByRole('heading', { name: 'New Engagement' });
    await user.clear(screen.getByLabelText(/engagement code/i));
    await user.type(screen.getByLabelText(/engagement code/i), 'ENG-100');
    await user.selectOptions(screen.getByLabelText(/^client/i), client.id);
    await user.type(screen.getByLabelText(/engagement type/i), 'Statutory Audit');
    await user.selectOptions(screen.getByLabelText(/responsible partner/i), partner.id);
    await user.selectOptions(screen.getByLabelText(/responsible manager/i), manager.id);
    await user.click(screen.getByRole('button', { name: /save engagement/i }));
    expect(await screen.findByText('Engagement saved')).toBeVisible();
    expect((await services.engagements.list())[0].engagementCode).toBe('ENG-100');
  });

  it('shows a Locked engagement workspace as read-only and hides mutation controls', async () => {
    const { engagement } = await seedUiEngagement('Locked');
    renderPage(<Routes><Route path="/engagements/:id" element={<EngagementWorkspacePage />} /></Routes>, `/engagements/${engagement.id}`);
    expect(await screen.findByText(/read-only engagement/i)).toBeVisible();
    expect(screen.queryByRole('link', { name: /edit engagement/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Team' }));
    expect(screen.getByText(/team changes disabled/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /assign team member/i })).toBeNull();
  });

  it('moves a task on the board through the validated TaskService transition', async () => {
    const task = await services.tasks.save({ ...emptyTask, title: 'Board Movement Test' }, 'Tester');
    renderPage(<TasksPage />);
    const select = await screen.findByLabelText('Move Board Movement Test');
    fireEvent.change(select, { target: { value: 'Assigned' } });
    await waitFor(async () => expect((await services.tasks.get(task.id))?.status).toBe('Assigned'));
    expect((await services.activity.forEntity('Task', task.id)).some(item => item.action === 'Status Change')).toBe(true);
  });

  it('applies and clears Dashboard period filtering', async () => {
    await seedUiEngagement();
    renderPage(<DashboardPage />);
    const activeCard = (await screen.findByText('Total Active Clients')).closest('.stat-card')!;
    expect(within(activeCard).getByText('1')).toBeVisible();
    await userEvent.type(screen.getByLabelText('Period'), '2099');
    await waitFor(() => expect(within(activeCard).getByText('0')).toBeVisible());
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(within(activeCard).getByText('1')).toBeVisible());
  });

  it('rejects an invalid backup file and shows a user-facing validation error', async () => {
    renderPage(<BackupRestorePage />);
    const file = new File(['{"bad":true}'], 'invalid.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('{"bad":true}') });
    fireEvent.change(screen.getByLabelText(/backup json file/i), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/unsupported|invalid|schema/i);
    expect(screen.getByText('Import Preview')).toBeVisible();
    expect(screen.getByRole('button', { name: /run restore/i })).toBeDisabled();
  });

  it('renders the Audit Planning Summary only for an Audit engagement', async () => {
    const { engagement } = await seedUiEngagement('Planning');
    renderPage(<Routes><Route path="/engagements/:id/audit-planning/:section" element={<AuditPlanningPage />} /></Routes>, `/engagements/${engagement.id}/audit-planning/summary`);
    expect(await screen.findByRole('heading', { name: /Audit Planning · Planning Summary/i })).toBeVisible();
    expect(screen.getByRole('navigation', { name: /Audit Planning sections/i })).toBeVisible();
    expect(screen.getByText(/Planning Readiness/i)).toBeVisible();
  });

  it('submits a draft Acceptance record through the Phase 2A form', async () => {
    const { engagement } = await seedUiEngagement();
    renderPage(<Routes><Route path="/engagements/:id/audit-planning/:section" element={<AuditPlanningPage />} /></Routes>, `/engagements/${engagement.id}/audit-planning/acceptance`);
    await screen.findByRole('heading', { name: /Audit Planning · Acceptance & Continuance/i });
    await userEvent.click(screen.getByRole('button', { name: /Save Acceptance/i }));
    await waitFor(async () => expect(await services.acceptance.forEngagement(engagement.id)).not.toBeNull());
  });

  it('shows Locked Audit Planning as read-only without mutation actions', async () => {
    const { engagement } = await seedUiEngagement('Locked');
    renderPage(<Routes><Route path="/engagements/:id/audit-planning/:section" element={<AuditPlanningPage />} /></Routes>, `/engagements/${engagement.id}/audit-planning/team-timeline`);
    expect(await screen.findByText(/Read-only engagement/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Save Team Assignment/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Save Milestone/i })).toBeNull();
  });

  it('does not expose Audit Planning controls for a non-Audit engagement', async () => {
    const { engagement } = await seedUiEngagement();
    await repositories.engagements.update({ ...engagement, serviceType: 'Tax', engagementType: 'Tax Compliance', recordVersion: engagement.recordVersion + 1 });
    renderPage(<Routes><Route path="/engagements/:id/audit-planning/:section" element={<AuditPlanningPage />} /></Routes>, `/engagements/${engagement.id}/audit-planning/summary`);
    expect(await screen.findByRole('heading', { name: /Audit Planning unavailable/i })).toBeVisible();
    expect(screen.getByText(/non-audit engagement/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Save/i })).toBeNull();
  });


  it.each([
    ['risks', 'Audit Risk Register'],
    ['materiality', 'Materiality Version History'],
    ['programme', 'Programme Template Library'],
    ['working-papers', 'Working Paper Index'],
    ['evidence', 'Evidence Register'],
    ['sampling', 'Basic Sampling Register'],
    ['document-requests', 'Document Request / PBC List'],
    ['activity', 'Phase 2 Activity History']
  ])('renders the Complete Phase 2 %s section', async (section, heading) => {
    const { engagement } = await seedUiEngagement('Planning');
    renderPage(<Routes><Route path="/engagements/:id/audit-planning/:section" element={<AuditPlanningPage />} /></Routes>, `/engagements/${engagement.id}/audit-planning/${section}`);
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
  });

  it('creates an Audit Risk through the Complete Phase 2 form after planning prerequisites', async () => {
    const user = userEvent.setup();
    const { engagement, manager, partner } = await seedUiEngagement('Planning');
    const date = new Date().toISOString().slice(0, 10);
    await services.acceptance.save({
      ...emptyAcceptance, engagementId: engagement.id, clientBackgroundSummary: 'Background', natureOfBusiness: 'Manufacturing',
      managementIntegrityAssessment: 'Acceptable', financialReportingFramework: 'IFRS', competenceResourcesAvailable: 'Available',
      acceptanceRecommendation: 'Accept', managerReviewerId: manager.id, partnerApproverId: partner.id,
      managerReviewDate: date, partnerApprovalDate: date, status: 'Approved'
    }, 'Tester');
    await services.independence.save({
      ...emptyIndependence, engagementId: engagement.id, assessmentDate: date, assessedById: manager.id,
      conclusion: 'Cleared', managerReviewed: true, partnerCleared: true, status: 'Cleared'
    }, 'Tester');
    renderPage(<Routes><Route path="/engagements/:id/audit-planning/:section" element={<AuditPlanningPage />} /></Routes>, `/engagements/${engagement.id}/audit-planning/risks`);
    await screen.findByRole('heading', { name: 'Audit Risk Register' });
    const riskForm = screen.getByRole('heading', { name: 'Create Risk' }).closest('form');
    expect(riskForm).not.toBeNull();
    const [riskCode, auditArea, riskTitle] = within(riskForm as HTMLFormElement).getAllByRole('textbox');
    await user.type(riskCode, 'R-UI-1');
    await user.type(auditArea, 'Revenue');
    await user.type(riskTitle, 'Revenue recognition');
    await user.click(screen.getByRole('button', { name: 'Save Risk' }));
    await waitFor(async () => expect(await services.auditRisks.forEngagement(engagement.id)).toHaveLength(1));
    expect(await screen.findByText(/R-UI-1/)).toBeVisible();
  });

});
