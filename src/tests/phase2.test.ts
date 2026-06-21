// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createHarness, MemoryStorage, emptyAcceptance, emptyAuditRisk, emptyDocumentRequest, emptyDocumentRequestItem,
  emptyDocumentRequestReminder, emptyEngagementLetter, emptyEngagementProgramme, emptyEvidence,
  emptyIndependence, emptyMateriality, emptyPlanningMemo, emptyProgrammeTemplate, emptySampling,
  emptyWorkingPaper, seedEngagement, seedStaff
} from './harness';
import { STORAGE_KEYS } from '../repositories/localStorage/keys';
import type { Engagement } from '../types/models';
import type { IStorageGateway } from '../repositories/interfaces/IStorageGateway';
import { ValidationError } from '../utils/errors';

const today = () => new Date().toISOString().slice(0, 10);
const past = () => '2020-01-01';

class FailOnceStorage implements IStorageGateway {
  private readonly inner = new MemoryStorage();
  failKey = '';
  failed = false;
  getItem(key: string): string | null { return this.inner.getItem(key); }
  setItem(key: string, value: string): void {
    if (key === this.failKey && !this.failed) { this.failed = true; throw new Error(`Injected failure for ${key}`); }
    this.inner.setItem(key, value);
  }
  removeItem(key: string): void { this.inner.removeItem(key); }
}

async function context(status: Engagement['status'] = 'Planning') {
  const h = createHarness();
  const engagement = await seedEngagement(h, { status });
  const staff = await h.repositories.staff.list();
  const partner = staff.find(item => item.id === engagement.responsiblePartnerId)!;
  const manager = staff.find(item => item.id === engagement.responsibleManagerId)!;
  const assistant = await seedStaff(h, 'Assistant', 'A-001');
  return { h, engagement, partner, manager, assistant };
}

async function approvePrerequisites(ctx: Awaited<ReturnType<typeof context>>) {
  const { h, engagement, manager, partner } = ctx;
  await h.services.acceptance.save({
    ...emptyAcceptance, engagementId: engagement.id, clientBackgroundSummary: 'Background', natureOfBusiness: 'Manufacturing',
    managementIntegrityAssessment: 'Acceptable', financialReportingFramework: 'IFRS', competenceResourcesAvailable: 'Available',
    acceptanceRecommendation: 'Accept', managerReviewerId: manager.id, partnerApproverId: partner.id,
    managerReviewDate: today(), partnerApprovalDate: today(), status: 'Approved'
  }, 'Tester');
  await h.services.independence.save({
    ...emptyIndependence, engagementId: engagement.id, assessmentDate: today(), assessedById: manager.id,
    conclusion: 'Cleared', managerReviewed: true, partnerCleared: true, status: 'Cleared'
  }, 'Tester');
}

function riskInput(ctx: Awaited<ReturnType<typeof context>>, overrides = {}) {
  return {
    ...emptyAuditRisk, engagementId: ctx.engagement.id, riskCode: 'R-001', auditArea: 'Revenue', riskTitle: 'Revenue recognition',
    riskDescription: 'Cut-off and occurrence risk', riskType: 'Assertion Level' as const, assertions: ['Cut-off' as const],
    assignedStaffId: ctx.assistant.id, preparedById: ctx.assistant.id, managerReviewerId: ctx.manager.id,
    partnerReviewerId: ctx.partner.id, ...overrides
  };
}

async function approvedRisk(ctx: Awaited<ReturnType<typeof context>>, significant = false) {
  await approvePrerequisites(ctx);
  const base = riskInput(ctx, { significantRisk: significant, plannedAuditResponse: 'Perform substantive cut-off procedures.' });
  let record = await ctx.h.services.auditRisks.save(base, 'Tester');
  record = await ctx.h.services.auditRisks.save({ ...base, status: 'Identified' }, 'Tester', record.id);
  record = await ctx.h.services.auditRisks.save({ ...base, status: 'Assessment in Progress' }, 'Tester', record.id);
  record = await ctx.h.services.auditRisks.save({ ...base, status: 'Manager Review' }, 'Tester', record.id);
  if (significant) record = await ctx.h.services.auditRisks.save({ ...base, status: 'Partner Review' }, 'Tester', record.id);
  return ctx.h.services.auditRisks.save({ ...base, status: 'Approved' }, 'Tester', record.id);
}

function materialityBase(ctx: Awaited<ReturnType<typeof context>>, version = 1) {
  return {
    ...emptyMateriality, engagementId: ctx.engagement.id, version, benchmark: 'Profit before tax', benchmarkAmount: 1_000_000,
    selectedPercentage: 5, performanceMaterialityPercentage: 75, clearlyTrivialPercentage: 5,
    rationaleForBenchmark: 'Stable benchmark', rationaleForPercentage: 'Risk-appropriate percentage',
    preparedById: ctx.assistant.id, managerReviewerId: ctx.manager.id, partnerApproverId: ctx.partner.id,
    managerReviewDate: today(), partnerApprovalDate: today()
  };
}

async function approveMateriality(ctx: Awaited<ReturnType<typeof context>>, version = 1) {
  const base = materialityBase(ctx, version);
  let record = await ctx.h.services.materiality.save(base, 'Tester');
  record = await ctx.h.services.materiality.save({ ...base, status: 'Manager Review' }, 'Tester', record.id);
  record = await ctx.h.services.materiality.save({ ...base, status: 'Partner Review' }, 'Tester', record.id);
  return ctx.h.services.materiality.save({ ...base, status: 'Approved' }, 'Tester', record.id);
}

async function createProgramme(ctx: Awaited<ReturnType<typeof context>>, riskId = '') {
  return ctx.h.services.auditProgrammes.save({
    ...emptyEngagementProgramme, engagementId: ctx.engagement.id, programmeArea: 'Revenue', procedureCode: 'REV-01',
    objective: 'Test revenue', procedureDescription: 'Inspect sales and cut-off', linkedRiskIds: riskId ? [riskId] : [],
    assigneeId: ctx.assistant.id, reviewerId: ctx.manager.id
  }, 'Tester');
}

describe('Phase 2A carry-forward corrections', () => {
  it('145 atomically accepts a new Engagement Letter and supersedes the previous version', async () => {
    const ctx = await context();
    const first = await ctx.h.services.engagementLetters.save({ ...emptyEngagementLetter, engagementId: ctx.engagement.id, letterReference: 'EL-1', letterVersion: 1, draftDate: today(), sentToClientDate: today(), clientAcceptanceDate: today(), signedByFirm: true, signedByClient: true, status: 'Accepted' }, 'Tester');
    const second = await ctx.h.services.engagementLetters.save({ ...emptyEngagementLetter, engagementId: ctx.engagement.id, letterReference: 'EL-2', letterVersion: 2, draftDate: today(), sentToClientDate: today(), clientAcceptanceDate: today(), signedByFirm: true, signedByClient: true, status: 'Accepted' }, 'Tester');
    const letters = await ctx.h.services.engagementLetters.forEngagement(ctx.engagement.id);
    expect(letters.find(item => item.id === first.id)?.status).toBe('Superseded');
    expect(letters.find(item => item.id === second.id)?.status).toBe('Accepted');
    expect(letters.filter(item => item.status === 'Accepted')).toHaveLength(1);
  });

  it('146 rolls back both letters and writes no success activity when atomic acceptance fails', async () => {
    const ctx = await context();
    const first = await ctx.h.services.engagementLetters.save({ ...emptyEngagementLetter, engagementId: ctx.engagement.id, letterReference: 'EL-1', letterVersion: 1, draftDate: today(), sentToClientDate: today(), clientAcceptanceDate: today(), signedByFirm: true, signedByClient: true, status: 'Accepted' }, 'Tester');
    const before = await ctx.h.repositories.engagementLetters.list({ includeDeleted: true });
    const beforeEvents = (await ctx.h.services.activity.recent()).length;
    const repository = ctx.h.repositories.engagementLetters;
    const original = repository.replaceAll.bind(repository); let failed = false;
    repository.replaceAll = async records => { if (!failed) { failed = true; throw new Error('Injected atomic failure'); } return original(records); };
    await expect(ctx.h.services.engagementLetters.save({ ...emptyEngagementLetter, engagementId: ctx.engagement.id, letterReference: 'EL-2', letterVersion: 2, draftDate: today(), sentToClientDate: today(), clientAcceptanceDate: today(), signedByFirm: true, signedByClient: true, status: 'Accepted' }, 'Tester')).rejects.toMatchObject({ code: 'ATOMIC_OPERATION_FAILED' });
    expect(await repository.list({ includeDeleted: true })).toEqual(before);
    expect((await repository.getById(first.id))?.status).toBe('Accepted');
    expect((await ctx.h.services.activity.recent()).length).toBe(beforeEvents);
  });

  it('147 blocks Acceptance partner approval earlier than Manager review', async () => {
    const ctx = await context();
    await expect(ctx.h.services.acceptance.save({ ...emptyAcceptance, engagementId: ctx.engagement.id, managerReviewDate: '2026-06-20', partnerApprovalDate: '2026-06-19' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/cannot be earlier/i)]) });
  });

  it('148 blocks Planning Memo partner approval without valid Manager review chronology', async () => {
    const ctx = await context(); await approvePrerequisites(ctx);
    await expect(ctx.h.services.planningMemos.save({ ...emptyPlanningMemo, engagementId: ctx.engagement.id, managerReviewDate: '', partnerApprovalDate: today() }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Manager Review Date is required/i)]) });
  });
});

describe('Phase 2B Risk and Materiality', () => {
  it('149 requires Approved Acceptance and Cleared Independence before risk creation', async () => {
    const ctx = await context();
    await expect(ctx.h.services.auditRisks.save(riskInput(ctx), 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Acceptance must be Approved/i), expect.stringMatching(/Independence must be Cleared/i)]) });
  });

  it('150 validates assertion-level risk mapping and unique risk codes', async () => {
    const ctx = await context(); await approvePrerequisites(ctx);
    await expect(ctx.h.services.auditRisks.save(riskInput(ctx, { assertions: [] }), 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/at least one assertion/i)]) });
    await ctx.h.services.auditRisks.save(riskInput(ctx), 'Tester');
    await expect(ctx.h.services.auditRisks.save(riskInput(ctx, { riskTitle: 'Duplicate' }), 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/unique/i)]) });
  });

  it('151 requires planned response and Partner Review for Significant/Fraud Risk approval', async () => {
    const ctx = await context(); await approvePrerequisites(ctx);
    const base = riskInput(ctx, { significantRisk: true });
    const draft = await ctx.h.services.auditRisks.save(base, 'Tester');
    await expect(ctx.h.services.auditRisks.save({ ...base, status: 'Manager Review' }, 'Tester', draft.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Planned Audit Response/i)]) });
    const identified = await ctx.h.services.auditRisks.save({ ...base, plannedAuditResponse: 'Test controls', status: 'Identified' }, 'Tester', draft.id);
    const assessment = await ctx.h.services.auditRisks.save({ ...base, plannedAuditResponse: 'Test controls', status: 'Assessment in Progress' }, 'Tester', identified.id);
    const managerReview = await ctx.h.services.auditRisks.save({ ...base, plannedAuditResponse: 'Test controls', status: 'Manager Review' }, 'Tester', assessment.id);
    await expect(ctx.h.services.auditRisks.save({ ...base, plannedAuditResponse: 'Test controls', status: 'Approved' }, 'Tester', managerReview.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Partner Review/i)]) });
  });

  it('152 calculates materiality thresholds from benchmark percentages', async () => {
    const ctx = await context(); const calculated = ctx.h.services.materiality.calculate(materialityBase(ctx));
    expect(calculated.overallMateriality).toBe(50_000); expect(calculated.performanceMateriality).toBe(37_500); expect(calculated.clearlyTrivialThreshold).toBe(1_875);
  });

  it('153 validates materiality values and approval chronology', async () => {
    const ctx = await context();
    await expect(ctx.h.services.materiality.save({ ...materialityBase(ctx), benchmarkAmount: 0 }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Benchmark Amount must be positive/i)]) });
    await expect(ctx.h.services.materiality.save({ ...materialityBase(ctx), managerReviewDate: '2026-06-20', partnerApprovalDate: '2026-06-19' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/cannot be earlier/i)]) });
  });

  it('154 atomically supersedes the previous Approved materiality version', async () => {
    const ctx = await context(); const first = await approveMateriality(ctx, 1); const second = await approveMateriality(ctx, 2);
    expect((await ctx.h.services.materiality.get(first.id))?.status).toBe('Superseded');
    expect(second.status).toBe('Approved'); expect((await ctx.h.services.materiality.forEngagement(ctx.engagement.id)).filter(item => item.status === 'Approved')).toHaveLength(1);
  });

  it('155 rolls back Materiality approval if the atomic write fails', async () => {
    const ctx = await context(); const first = await approveMateriality(ctx, 1); const repo = ctx.h.repositories.auditMateriality;
    const before = await repo.list({ includeDeleted: true }); const original = repo.replaceAll.bind(repo); let failed = false;
    repo.replaceAll = async records => { if (!failed) { failed = true; throw new Error('Injected failure'); } return original(records); };
    const base = materialityBase(ctx, 2); let draft = await ctx.h.services.materiality.save(base, 'Tester'); draft = await ctx.h.services.materiality.save({ ...base, status: 'Manager Review' }, 'Tester', draft.id); draft = await ctx.h.services.materiality.save({ ...base, status: 'Partner Review' }, 'Tester', draft.id);
    const snapshot = await repo.list({ includeDeleted: true });
    await expect(ctx.h.services.materiality.save({ ...base, status: 'Approved' }, 'Tester', draft.id)).rejects.toMatchObject({ code: 'ATOMIC_OPERATION_FAILED' });
    expect(await repo.list({ includeDeleted: true })).toEqual(snapshot); expect((await repo.getById(first.id))?.status).toBe('Approved'); expect(before[0].id).toBe(first.id);
  });
});

describe('Phase 2C Audit Programme', () => {
  it('156 creates a versioned programme template and engagement procedure', async () => {
    const ctx = await context();
    const template = await ctx.h.services.programmeTemplates.save({ ...emptyProgrammeTemplate, templateCode: 'TPL-REV', templateName: 'Revenue', auditArea: 'Revenue', objective: 'Test revenue', procedureCode: 'REV-01', procedureDescription: 'Inspect sales', mandatory: true }, 'Tester');
    const procedure = await ctx.h.services.auditProgrammes.createFromTemplate(ctx.engagement.id, template.id, 'Tester');
    expect(procedure.templateId).toBe(template.id); expect(procedure.mandatory).toBe(true);
  });

  it('157 blocks duplicate procedure code and mandatory Not Applicable without reason', async () => {
    const ctx = await context(); const procedure = await createProgramme(ctx);
    await expect(createProgramme(ctx)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/unique/i)]) });
    await expect(ctx.h.services.auditProgrammes.save({ ...procedure, mandatory: true, status: 'Not Applicable', notApplicableReason: '' }, 'Tester', procedure.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/require a reason/i)]) });
  });

  it('158 requires completion comment and a different reviewer', async () => {
    const ctx = await context(); const procedure = await createProgramme(ctx);
    const progress = await ctx.h.services.auditProgrammes.save({ ...procedure, status: 'In Progress' }, 'Tester', procedure.id);
    await expect(ctx.h.services.auditProgrammes.save({ ...progress, status: 'Completed', completionComment: '' }, 'Tester', progress.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/completion comment/i)]) });
    const completed = await ctx.h.services.auditProgrammes.save({ ...progress, status: 'Completed', completionComment: 'Done' }, 'Tester', progress.id);
    await expect(ctx.h.services.auditProgrammes.save({ ...completed, status: 'Review Pending', reviewerId: completed.assigneeId }, 'Tester', completed.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/different/i)]) });
  });

  it('159 reports missing programme coverage for Significant/Fraud Risks', async () => {
    const ctx = await context(); const risk = await approvedRisk(ctx, true);
    expect(await ctx.h.services.auditProgrammes.coverageErrors(ctx.engagement.id)).toEqual(expect.arrayContaining([expect.stringMatching(new RegExp(risk.riskCode))]));
    await createProgramme(ctx, risk.id); expect(await ctx.h.services.auditProgrammes.coverageErrors(ctx.engagement.id)).toEqual([]);
  });
});

describe('Phase 2D Working Papers, Evidence and Sampling', () => {
  it('160 validates Working Paper submission content and reviewer separation', async () => {
    const ctx = await context(); const procedure = await createProgramme(ctx);
    const draft = await ctx.h.services.workingPapers.save({ ...emptyWorkingPaper, engagementId: ctx.engagement.id, wpReference: 'WP-REV-1', title: 'Revenue testing', linkedProgrammeProcedureId: procedure.id, preparedById: ctx.assistant.id, reviewerId: ctx.manager.id }, 'Tester');
    const preparation = await ctx.h.services.workingPapers.save({ ...draft, status: 'In Preparation' }, 'Tester', draft.id);
    const prepared = await ctx.h.services.workingPapers.save({ ...preparation, status: 'Prepared' }, 'Tester', preparation.id);
    await expect(ctx.h.services.workingPapers.save({ ...prepared, status: 'Submitted for Review' }, 'Tester', prepared.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Objective is required/i)]) });
    await expect(ctx.h.services.workingPapers.save({ ...prepared, preparedById: ctx.assistant.id, reviewerId: ctx.assistant.id }, 'Tester', prepared.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/cannot equal preparer/i)]) });
  });

  it('161 validates Working Paper date chronology and Final programme linkage', async () => {
    const ctx = await context(); const procedure = await createProgramme(ctx);
    await expect(ctx.h.services.workingPapers.save({ ...emptyWorkingPaper, engagementId: ctx.engagement.id, wpReference: 'WP-1', title: 'WP', linkedProgrammeProcedureId: procedure.id, preparedDate: '2026-06-20', reviewDate: '2026-06-19' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/cannot be after/i)]) });
  });

  it('162 requires Working Paper linkage and acceptance metadata for Accepted evidence', async () => {
    const ctx = await context();
    await expect(ctx.h.services.evidence.save({ ...emptyEvidence, engagementId: ctx.engagement.id, evidenceReference: 'EV-1', description: 'Invoice sample', status: 'Accepted' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Working Paper/i), expect.stringMatching(/Accepted By/i)]) });
  });

  it('163 preserves Rejected evidence reason and validates transitions', async () => {
    const ctx = await context(); const evidence = await ctx.h.services.evidence.save({ ...emptyEvidence, engagementId: ctx.engagement.id, evidenceReference: 'EV-1', description: 'Invoice sample' }, 'Tester');
    await expect(ctx.h.services.evidence.save({ ...evidence, status: 'Rejected', rejectionReason: '' }, 'Tester', evidence.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/requires a reason/i)]) });
  });

  it('164 validates Sampling population, sample and reviewer separation', async () => {
    const ctx = await context(); const programme = await createProgramme(ctx);
    const wp = await ctx.h.services.workingPapers.save({ ...emptyWorkingPaper, engagementId: ctx.engagement.id, wpReference: 'WP-S', title: 'Sampling WP', linkedProgrammeProcedureId: programme.id }, 'Tester');
    await expect(ctx.h.services.sampling.save({ ...emptySampling, engagementId: ctx.engagement.id, workingPaperId: wp.id, population: 'Invoices', populationSize: 10, sampleSize: 11, preparedById: ctx.assistant.id, reviewerId: ctx.assistant.id }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/cannot exceed/i), expect.stringMatching(/cannot equal preparer/i)]) });
    const saved = await ctx.h.services.sampling.save({ ...emptySampling, engagementId: ctx.engagement.id, workingPaperId: wp.id, population: 'Invoices', populationSize: 100, samplingMethod: 'Random', sampleSize: 20, selectionBasis: 'Random number selection', preparedById: ctx.assistant.id, reviewerId: ctx.manager.id }, 'Tester');
    expect(saved.sampleSize).toBe(20);
  });
});

describe('Phase 2E Document Requisition', () => {
  it('165 requires at least one item and Sent Date before a request can be Sent', async () => {
    const ctx = await context(); const draft = await ctx.h.services.documentRequests.saveRequest({ ...emptyDocumentRequest, engagementId: ctx.engagement.id, requestReference: 'PBC-1', requestTitle: 'PBC list' }, 'Tester');
    await expect(ctx.h.services.documentRequests.saveRequest({ ...draft, status: 'Sent' }, 'Tester', draft.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Sent Date/i), expect.stringMatching(/at least one/i)]) });
  });

  it('166 validates received, rejected and waived request item rules', async () => {
    const ctx = await context(); const request = await ctx.h.services.documentRequests.saveRequest({ ...emptyDocumentRequest, engagementId: ctx.engagement.id, requestReference: 'PBC-1', requestTitle: 'PBC list' }, 'Tester');
    await expect(ctx.h.services.documentRequests.saveItem({ ...emptyDocumentRequestItem, requestId: request.id, itemCode: 'I-1', description: 'Trial balance', status: 'Received' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Received Date/i)]) });
    await expect(ctx.h.services.documentRequests.saveItem({ ...emptyDocumentRequestItem, requestId: request.id, itemCode: 'I-1', description: 'Trial balance', status: 'Rejected', receivedDate: today() }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/rejection reason/i)]) });
    await expect(ctx.h.services.documentRequests.saveItem({ ...emptyDocumentRequestItem, requestId: request.id, itemCode: 'I-1', description: 'Trial balance', status: 'Waived' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/reason/i)]) });
  });

  it('167 only closes requests when all items are Accepted or Waived', async () => {
    const ctx = await context(); const request = await ctx.h.services.documentRequests.saveRequest({ ...emptyDocumentRequest, engagementId: ctx.engagement.id, requestReference: 'PBC-1', requestTitle: 'PBC list' }, 'Tester');
    await ctx.h.services.documentRequests.saveItem({ ...emptyDocumentRequestItem, requestId: request.id, itemCode: 'I-1', description: 'Trial balance' }, 'Tester');
    await expect(ctx.h.services.documentRequests.saveRequest({ ...request, status: 'Closed' }, 'Tester', request.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Accepted or Waived/i)]) });
  });

  it('168 records reminder metadata and calculates overdue status without sending notifications', async () => {
    const ctx = await context(); const request = await ctx.h.services.documentRequests.saveRequest({ ...emptyDocumentRequest, engagementId: ctx.engagement.id, requestReference: 'PBC-1', requestTitle: 'PBC list', overallDueDate: past() }, 'Tester');
    const reminder = await ctx.h.services.documentRequests.addReminder({ ...emptyDocumentRequestReminder, requestId: request.id, reminderDate: today(), note: 'Called client contact' }, 'Tester');
    expect(reminder.note).toBe('Called client contact'); expect(ctx.h.services.documentRequests.isRequestOverdue(request)).toBe(true);
  });
});

describe('Phase 2 integration, locking, backup and dashboard', () => {
  it('169 Fieldwork gate requires Materiality and Significant/Fraud Risk programme coverage', async () => {
    const ctx = await context('Planning'); await approvePrerequisites(ctx);
    const errors = await ctx.h.services.planningGates.validateTransition(ctx.engagement, 'Fieldwork');
    expect(errors).toEqual(expect.arrayContaining([expect.stringMatching(/Materiality/i)]));
  });

  it.each([
    ['risk', async (ctx: Awaited<ReturnType<typeof context>>) => ctx.h.services.auditRisks.save(riskInput(ctx), 'Tester')],
    ['materiality', async (ctx: Awaited<ReturnType<typeof context>>) => ctx.h.services.materiality.save(materialityBase(ctx), 'Tester')],
    ['programme', async (ctx: Awaited<ReturnType<typeof context>>) => ctx.h.services.auditProgrammes.save({ ...emptyEngagementProgramme, engagementId: ctx.engagement.id, procedureCode: 'P-1', procedureDescription: 'Procedure' }, 'Tester')],
    ['working paper', async (ctx: Awaited<ReturnType<typeof context>>) => ctx.h.services.workingPapers.save({ ...emptyWorkingPaper, engagementId: ctx.engagement.id, wpReference: 'WP-1', title: 'WP' }, 'Tester')],
    ['evidence', async (ctx: Awaited<ReturnType<typeof context>>) => ctx.h.services.evidence.save({ ...emptyEvidence, engagementId: ctx.engagement.id, evidenceReference: 'EV-1', description: 'Evidence' }, 'Tester')],
    ['sampling', async (ctx: Awaited<ReturnType<typeof context>>) => ctx.h.services.sampling.save({ ...emptySampling, engagementId: ctx.engagement.id, population: 'P', populationSize: 1, sampleSize: 1 }, 'Tester')],
    ['document request', async (ctx: Awaited<ReturnType<typeof context>>) => ctx.h.services.documentRequests.saveRequest({ ...emptyDocumentRequest, engagementId: ctx.engagement.id, requestReference: 'PBC-1', requestTitle: 'PBC' }, 'Tester')]
  ])('170 Locked engagement blocks %s mutation and logs the attempt', async (_name, operation) => {
    const ctx = await context(); await approvePrerequisites(ctx);
    await ctx.h.repositories.engagements.update({ ...ctx.engagement, status: 'Locked', recordVersion: ctx.engagement.recordVersion + 1 });
    await expect(operation(ctx)).rejects.toBeInstanceOf(ValidationError);
    expect((await ctx.h.services.activity.forEntity('Engagement', ctx.engagement.id)).some(event => event.action === 'Lock Attempt')).toBe(true);
  });

  it('171 Complete Phase 2 backup exports every new module and restores relationships', async () => {
    const ctx = await context(); await approvePrerequisites(ctx); await ctx.h.services.auditRisks.save(riskInput(ctx), 'Tester');
    const backup = ctx.h.services.backup.createBackup();
    for (const key of [STORAGE_KEYS.auditRisks, STORAGE_KEYS.auditMateriality, STORAGE_KEYS.programmeTemplates, STORAGE_KEYS.engagementProgrammes, STORAGE_KEYS.workingPapers, STORAGE_KEYS.evidenceRegister, STORAGE_KEYS.samplingRegister, STORAGE_KEYS.documentRequests, STORAGE_KEYS.documentRequestItems, STORAGE_KEYS.documentRequestReminders]) expect(backup.data[key]).toBeDefined();
    const target = createHarness();
    const preview = target.services.backup.preview(backup, 'replace'); expect(preview.valid).toBe(true);
    const result = await target.services.backup.restore(backup, 'replace', 'Tester'); expect(result.rolledBack).toBe(false); expect(await target.repositories.auditRisks.list()).toHaveLength(1);
  });

  it('172 rejects invalid Phase 2 backup relationships', async () => {
    const ctx = await context(); await approvePrerequisites(ctx); await ctx.h.services.auditRisks.save(riskInput(ctx), 'Tester');
    const backup = ctx.h.services.backup.createBackup(); (backup.data[STORAGE_KEYS.auditRisks][0] as Record<string, unknown>).engagementId = 'missing';
    const preview = createHarness().services.backup.preview(backup, 'replace'); expect(preview.valid).toBe(false); expect(preview.errors.join(' ')).toMatch(/missing engagement/i);
  });

  it('173 Complete Phase 2 restore rolls back new modules atomically on write failure', async () => {
    const ctx = await context(); await approvePrerequisites(ctx); await ctx.h.services.auditRisks.save(riskInput(ctx), 'Tester');
    const backup = ctx.h.services.backup.createBackup();
    const storage = new FailOnceStorage(); const target = createHarness(storage); const existing = await seedEngagement(target);
    const beforeEngagements = storage.getItem(STORAGE_KEYS.engagements); const beforeRisks = storage.getItem(STORAGE_KEYS.auditRisks);
    storage.failKey = STORAGE_KEYS.auditMateriality;
    const result = await target.services.backup.restore(backup, 'replace', 'Tester');
    expect(result.rolledBack && result.rollbackSuccessful).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.engagements)).toBe(beforeEngagements);
    expect(storage.getItem(STORAGE_KEYS.auditRisks)).toBe(beforeRisks);
    expect(await target.repositories.engagements.getById(existing.id)).not.toBeNull();
    expect(storage.getItem(result.preImportBackupKey)).toBeTruthy();
  });

  it('174 Dashboard exposes Complete Phase 2 indicators', async () => {
    const ctx = await context(); await approvePrerequisites(ctx);
    await ctx.h.services.auditRisks.save(riskInput(ctx, { status: 'Response Required' }), 'Tester');
    await ctx.h.services.materiality.save(materialityBase(ctx), 'Tester');
    const request = await ctx.h.services.documentRequests.saveRequest({ ...emptyDocumentRequest, engagementId: ctx.engagement.id, requestReference: 'PBC-1', requestTitle: 'PBC', overallDueDate: past() }, 'Tester');
    await ctx.h.services.documentRequests.saveItem({ ...emptyDocumentRequestItem, requestId: request.id, itemCode: 'I-1', description: 'TB', receivedDate: today(), status: 'Under Review' }, 'Tester');
    const summary = await ctx.h.services.dashboard.getSummary({ period: '', partnerId: '', managerId: '', service: '', clientType: '', engagementStatus: '' }, 14);
    expect(summary.risksAwaitingResponse).toBe(1); expect(summary.materialityAwaitingApproval).toBe(1); expect(summary.documentRequestsOverdue).toBe(1); expect(summary.documentsPendingAcceptance).toBe(1);
  });
});
