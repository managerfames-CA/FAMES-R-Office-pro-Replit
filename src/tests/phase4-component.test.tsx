import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../components/AppContext';
import { Phase4DirectoryPage, Phase4WorkspacePage } from '../features/phase4/Phase4Pages';
import { DashboardPage } from '../pages/DashboardPage';
import { services } from '../services';
import { repositories } from '../repositories';
import { emptyClient, emptyEngagement, emptyStaff } from '../constants/defaults';
import type { Engagement, ServiceType } from '../types/models';

function renderWorkspace(path: string) {
  return render(<AppProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/engagements/:id/phase4/:section?" element={<Phase4WorkspacePage />} />
    <Route path="/workspaces/:service" element={<Phase4DirectoryPage />} />
  </Routes></MemoryRouter></AppProvider>);
}

let seedSequence = 0;

async function seedStaff(suffix: string) {
  const partner = await services.staff.save({ ...emptyStaff, staffCode: `P-P4-UI-${suffix}`, fullName: 'Phase 4 Partner', role: 'Partner' }, 'Tester');
  const manager = await services.staff.save({ ...emptyStaff, staffCode: `M-P4-UI-${suffix}`, fullName: 'Phase 4 Manager', role: 'Manager' }, 'Tester');
  const assistant = await services.staff.save({ ...emptyStaff, staffCode: `A-P4-UI-${suffix}`, fullName: 'Phase 4 Assistant', role: 'Assistant' }, 'Tester');
  const qualityReviewer = await services.staff.save({ ...emptyStaff, staffCode: `Q-P4-UI-${suffix}`, fullName: 'Phase 4 Quality Reviewer', role: 'Quality Reviewer' }, 'Tester');
  return { partner, manager, assistant, qualityReviewer };
}

async function seedEngagement(serviceType: ServiceType = 'Audit', listed = false) {
  const suffix = String(++seedSequence);
  const staff = await seedStaff(suffix);
  const client = await services.clients.create({
    ...emptyClient, clientCode: `CL-${serviceType}-P4-${suffix}`, legalName: `${serviceType} Phase 4 Client`, entityType: 'Company',
    status: 'Active', isListedPie: listed, responsiblePartnerId: staff.partner.id, responsibleManagerId: staff.manager.id
  }, 'Tester');
  const engagement = await services.engagements.create({
    ...emptyEngagement, engagementCode: `ENG-${serviceType}-P4-${suffix}`, clientId: client.id, serviceType,
    engagementType: `${serviceType} Assignment`, financialPeriodStart: '2026-01-01', financialPeriodEnd: '2026-12-31',
    responsiblePartnerId: staff.partner.id, responsibleManagerId: staff.manager.id, listedPieWorkflowRequired: listed
  }, 'Tester');
  return { client, engagement, ...staff };
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('Phase 4 route rendering', () => {
  it.each([
    ['summary', 'Listed profile'],
    ['compliance', 'Listed/PIE Compliance Checklist'],
    ['deadlines', 'Regulatory Deadline Calendar'],
    ['committee', 'Audit Committee Communications'],
    ['eqr', 'Engagement Quality Review'],
    ['kam', 'Key Audit Matter Register']
  ])('renders the Listed/PIE %s section', async (section, heading) => {
    const { engagement } = await seedEngagement('Audit', true);
    renderWorkspace(`/engagements/${engagement.id}/phase4/${section}`);
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
  });

  it('blocks the Listed workspace for a normal Audit client', async () => {
    const { engagement } = await seedEngagement('Audit', false);
    renderWorkspace(`/engagements/${engagement.id}/phase4/summary`);
    expect(await screen.findByRole('heading', { name: 'Listed/PIE Workspace Unavailable' })).toBeVisible();
  });

  it('shows only service-matched engagements in a directory', async () => {
    const tax = await seedEngagement('Tax');
    const vat = await seedEngagement('VAT');
    renderWorkspace('/workspaces/tax');
    expect(await screen.findByText(tax.engagement.engagementCode)).toBeVisible();
    expect(screen.queryByText(vat.engagement.engagementCode)).toBeNull();
  });
});

describe('Phase 4 React interactions', () => {
  it('creates the approved 18-item Listed compliance checklist', async () => {
    const user = userEvent.setup();
    const { engagement } = await seedEngagement('Audit', true);
    renderWorkspace(`/engagements/${engagement.id}/phase4/compliance`);
    await user.click(await screen.findByRole('button', { name: 'Create Default Checklist' }));
    await waitFor(async () => expect((await repositories.listedComplianceItems.list()).filter(i => i.engagementId === engagement.id)).toHaveLength(18));
    expect(await screen.findByText(/LPIE-18/)).toBeVisible();
  });

  it('calculates and saves a VAT assignment through the service-backed form', async () => {
    const user = userEvent.setup();
    const { engagement, assistant, manager } = await seedEngagement('VAT');
    renderWorkspace(`/engagements/${engagement.id}/phase4/assignment`);
    await user.type(await screen.findByLabelText('VAT Period'), 'June 2026');
    await user.type(screen.getByLabelText('BIN'), '123456789');
    await user.type(screen.getByLabelText('Filing Deadline'), '2026-07-15');
    await user.clear(screen.getByLabelText('Output VAT')); await user.type(screen.getByLabelText('Output VAT'), '100');
    await user.clear(screen.getByLabelText('Input VAT')); await user.type(screen.getByLabelText('Input VAT'), '40');
    await user.clear(screen.getByLabelText('Adjustments')); await user.type(screen.getByLabelText('Adjustments'), '5');
    await user.selectOptions(screen.getByLabelText('Responsible Staff'), assistant.id);
    await user.selectOptions(screen.getByLabelText('Manager Reviewer'), manager.id);
    expect(screen.getByLabelText('Net VAT Payable/Refundable')).toHaveValue('65');
    await user.click(screen.getByRole('button', { name: 'Save VAT Assignment' }));
    await waitFor(async () => expect((await repositories.vatAssignments.list())[0]?.netVatPayableRefundable).toBe(65));
  });

  it('keeps a Locked service workspace read-only', async () => {
    const { engagement } = await seedEngagement('Tax');
    const locked: Engagement = { ...engagement, status: 'Locked', updatedAt: new Date().toISOString(), recordVersion: engagement.recordVersion + 1 };
    await repositories.engagements.update(locked);
    renderWorkspace(`/engagements/${engagement.id}/phase4/assignment`);
    expect(await screen.findByText(/Read-only/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Save Tax Assignment' })).toBeNull();
  });

  it('renders the new Dashboard indicator group from repository data', async () => {
    render(<AppProvider><MemoryRouter><DashboardPage /></MemoryRouter></AppProvider>);
    expect(await screen.findByRole('heading', { name: 'Listed/PIE and Service Workflows' })).toBeVisible();
    expect(screen.getByText('EQR awaiting completion')).toBeVisible();
    expect(screen.getByText('Advisory awaiting client action')).toBeVisible();
  });
});
