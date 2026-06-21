import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../components/AppContext';
import { AuditPlanningPage } from '../features/auditPlanning/AuditPlanningPage';
import { services } from '../services';
import { repositories } from '../repositories';
import { createMetadata } from '../services/helpers';
import { emptyClient, emptyEngagement, emptyEngagementProgramme, emptyStaff, emptyWorkingPaper } from '../constants/defaults';
import type { Engagement, EngagementProgramme, WorkingPaper } from '../types/models';

function renderAudit(path: string) {
  return render(
    <AppProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/engagements/:id/audit-planning/:section" element={<AuditPlanningPage />} /></Routes>
      </MemoryRouter>
    </AppProvider>
  );
}

async function seedAuditEngagement(status: Engagement['status'] = 'Manager Review') {
  const client = await services.clients.create({ ...emptyClient, clientCode: 'CL-P3-UI', legalName: 'Phase 3 UI Client', status: 'Active', entityType: 'Company' }, 'Tester');
  const partner = await services.staff.save({ ...emptyStaff, staffCode: 'P-P3-UI', fullName: 'Phase 3 Partner', role: 'Partner' }, 'Tester');
  const manager = await services.staff.save({ ...emptyStaff, staffCode: 'M-P3-UI', fullName: 'Phase 3 Manager', role: 'Manager' }, 'Tester');
  const assistant = await services.staff.save({ ...emptyStaff, staffCode: 'A-P3-UI', fullName: 'Phase 3 Assistant', role: 'Assistant' }, 'Tester');
  const engagement = await services.engagements.create({
    ...emptyEngagement,
    engagementCode: 'ENG-P3-UI', clientId: client.id, serviceType: 'Audit', engagementType: 'Statutory Audit',
    responsiblePartnerId: partner.id, responsibleManagerId: manager.id,
    financialPeriodStart: '2025-01-01', financialPeriodEnd: '2025-12-31'
  }, 'Tester');
  if (status !== 'Draft') {
    const changed = { ...engagement, status, updatedAt: new Date().toISOString(), recordVersion: engagement.recordVersion + 1 };
    await repositories.engagements.update(changed);
    return { client, partner, manager, assistant, engagement: changed };
  }
  return { client, partner, manager, assistant, engagement };
}

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
afterEach(() => cleanup());

describe('Phase 3 workspace rendering', () => {
  it.each([
    ['review-notes', 'Review Notes'],
    ['manager-review', 'Manager Review Readiness'],
    ['partner-review', 'Partner Approval Readiness'],
    ['completion-checklist', 'Audit Completion Checklist'],
    ['findings', 'Audit Findings and Misstatements'],
    ['audit-reports', 'Audit Report Versions'],
    ['management-letter', 'Management Letter Register'],
    ['representation-letter', 'Representation Letter Register'],
    ['report-issue', 'Final Report Issue Register'],
    ['file-lock', 'Engagement File Lock'],
    ['amendments', 'Post-Issue Amendment Register']
  ])('renders the %s Phase 3 section', async (section, heading) => {
    const { engagement } = await seedAuditEngagement();
    renderAudit(`/engagements/${engagement.id}/audit-planning/${section}`);
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
  });
});

describe('Phase 3 React interactions', () => {
  it('raises a Review Note through the service-backed form', async () => {
    const user = userEvent.setup();
    const { engagement, manager, assistant } = await seedAuditEngagement();
    renderAudit(`/engagements/${engagement.id}/audit-planning/review-notes`);
    const noteForm = (await screen.findByRole('heading', { name: 'Raise Review Note' })).closest('form')!;
    const noteFields = within(noteForm).getAllByLabelText(/Review Note/i);
    await user.type(noteFields[0], 'RN-UI-1');
    await user.type(noteFields[1], 'Resolve the review point.');
    await user.selectOptions(screen.getByLabelText(/Raised By/i), manager.id);
    await user.selectOptions(screen.getByLabelText(/Assigned To/i), assistant.id);
    await user.click(screen.getByRole('button', { name: 'Save Review Note' }));
    await waitFor(async () => expect(await services.reviewNotes.list(engagement.id)).toHaveLength(1));
    expect(await screen.findByText('RN-UI-1')).toBeVisible();
  });

  it('creates the approved default completion checklist', async () => {
    const user = userEvent.setup();
    const { engagement } = await seedAuditEngagement();
    renderAudit(`/engagements/${engagement.id}/audit-planning/completion-checklist`);
    await user.click(await screen.findByRole('button', { name: 'Create Default Checklist' }));
    await waitFor(async () => expect(await services.completion.list(engagement.id)).toHaveLength(18));
    expect(await screen.findByText('ACP-18')).toBeVisible();
  });

  it('creates a finding and displays the calculated uncorrected amount', async () => {
    const user = userEvent.setup();
    const { engagement } = await seedAuditEngagement();
    renderAudit(`/engagements/${engagement.id}/audit-planning/findings`);
    const form = (await screen.findByRole('heading', { name: 'Create Finding' })).closest('form')!;
    await user.type(within(form).getByLabelText(/Finding Reference/i), 'F-UI-1');
    await user.type(within(form).getByLabelText(/^Description/i), 'Uncorrected audit difference.');
    await user.clear(within(form).getByLabelText(/^Amount/i));
    await user.type(within(form).getByLabelText(/^Amount/i), '1250');
    await user.click(within(form).getByRole('button', { name: 'Save Finding' }));
    await waitFor(async () => expect((await services.findings.list(engagement.id))[0]?.uncorrectedAmount).toBe(1250));
    expect(await screen.findByText('F-UI-1')).toBeVisible();
  });

  it('creates a Draft Audit Report version through the report form', async () => {
    const user = userEvent.setup();
    const { engagement } = await seedAuditEngagement();
    renderAudit(`/engagements/${engagement.id}/audit-planning/audit-reports`);
    const form = (await screen.findByRole('heading', { name: 'Create Report Version' })).closest('form')!;
    await user.clear(within(form).getByLabelText(/Report Type/i));
    await user.type(within(form).getByLabelText(/Report Type/i), 'Independent Auditor Report');
    await user.click(within(form).getByRole('button', { name: 'Save Report Version' }));
    await waitFor(async () => expect(await services.reporting.reports(engagement.id)).toHaveLength(1));
    expect(await screen.findByText('Independent Auditor Report')).toBeVisible();
  });

  it('manager-clears a submitted Working Paper from Manager Review Workspace', async () => {
    const user = userEvent.setup();
    const { engagement, manager, assistant } = await seedAuditEngagement();
    const programme: EngagementProgramme = {
      ...createMetadata('Reviewed', 'Tester'), ...emptyEngagementProgramme,
      engagementId: engagement.id, programmeArea: 'Revenue', procedureCode: 'P-UI-1', objective: 'Test revenue',
      procedureDescription: 'Inspect support', mandatory: true, assigneeId: assistant.id, reviewerId: manager.id,
      status: 'Reviewed', completionComment: 'Completed', managerReviewComment: 'Reviewed'
    };
    await repositories.engagementProgrammes.create(programme);
    const paper: WorkingPaper = {
      ...createMetadata('Submitted for Review', 'Tester'), ...emptyWorkingPaper,
      engagementId: engagement.id, wpReference: 'WP-UI-1', auditArea: 'Revenue', title: 'Revenue test', objective: 'Test occurrence',
      linkedProgrammeProcedureId: programme.id, procedurePerformed: 'Inspected support', result: 'No exception', conclusion: 'Supported',
      preparedById: assistant.id, preparedDate: '2026-06-20', status: 'Submitted for Review'
    };
    await repositories.workingPapers.create(paper);
    renderAudit(`/engagements/${engagement.id}/audit-planning/manager-review`);
    await user.selectOptions(await screen.findByLabelText('Manager'), manager.id);
    await user.click(screen.getByRole('button', { name: 'Review & Clear' }));
    await waitFor(async () => expect((await services.workingPapers.get(paper.id))?.status).toBe('Manager Cleared'));
  });

  it('keeps normal Phase 3 forms read-only after file lock while exposing controlled amendment request', async () => {
    const { engagement } = await seedAuditEngagement('Locked');
    const view = renderAudit(`/engagements/${engagement.id}/audit-planning/review-notes`);
    expect(await screen.findByText(/Read-only engagement/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Save Review Note' })).toBeNull();
    view.unmount();
    renderAudit(`/engagements/${engagement.id}/audit-planning/amendments`);
    expect(await screen.findByRole('heading', { name: 'Request Controlled Amendment' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Amendment Request' })).toBeVisible();
  });
});
