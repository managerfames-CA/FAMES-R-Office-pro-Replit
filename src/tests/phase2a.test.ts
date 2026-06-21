// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createHarness, MemoryStorage, emptyAcceptance, emptyEngagementLetter, emptyIndependence, emptyMateriality,
  emptyPlanningMemo, emptyPlanningMilestone, emptyTeam, seedEngagement
} from './harness';
import type { IStorageGateway } from '../repositories/interfaces/IStorageGateway';
import type { BackupEnvelope, Engagement } from '../types/models';
import { STORAGE_KEYS } from '../repositories/localStorage/keys';
import { REQUIRED_PLANNING_MILESTONES } from '../constants/statuses';
import { ValidationError } from '../utils/errors';

const today = () => new Date().toISOString().slice(0, 10);
const future = (days = 10) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

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

async function context(status: Engagement['status'] = 'Draft') {
  const h = createHarness();
  const engagement = await seedEngagement(h, { status });
  const staff = await h.repositories.staff.list();
  const partner = staff.find(item => item.id === engagement.responsiblePartnerId)!;
  const manager = staff.find(item => item.id === engagement.responsibleManagerId)!;
  return { h, engagement, partner, manager };
}

async function createApprovedAcceptance(ctx: Awaited<ReturnType<typeof context>>) {
  const { h, engagement, partner, manager } = ctx;
  return h.services.acceptance.save({
    ...emptyAcceptance, engagementId: engagement.id, clientBackgroundSummary: 'Established audit client', natureOfBusiness: 'Manufacturing',
    managementIntegrityAssessment: 'Acceptable', financialReportingFramework: 'IFRS', competenceResourcesAvailable: 'Available',
    acceptanceRecommendation: 'Accept', managerReviewerId: manager.id, partnerApproverId: partner.id,
    managerReviewDate: today(), partnerApprovalDate: today(), status: 'Approved'
  }, 'Tester');
}

async function createClearedIndependence(ctx: Awaited<ReturnType<typeof context>>) {
  const { h, engagement, manager } = ctx;
  return h.services.independence.save({
    ...emptyIndependence, engagementId: engagement.id, assessmentDate: today(), assessedById: manager.id,
    conclusion: 'Independent and cleared', managerReviewed: true, partnerCleared: true, status: 'Cleared'
  }, 'Tester');
}

async function createAcceptedLetter(ctx: Awaited<ReturnType<typeof context>>, reference = 'EL-001', version = 1) {
  const { h, engagement } = ctx;
  return h.services.engagementLetters.save({
    ...emptyEngagementLetter, engagementId: engagement.id, letterReference: reference, letterVersion: version,
    draftDate: today(), sentToClientDate: today(), clientAcceptanceDate: today(), effectiveDate: today(),
    signedByFirm: true, signedByClient: true, clientSignatory: 'Authorised Signatory', status: 'Accepted'
  }, 'Tester');
}

async function createApprovedMemo(ctx: Awaited<ReturnType<typeof context>>) {
  const { h, engagement, partner, manager } = ctx;
  return h.services.planningMemos.save({
    ...emptyPlanningMemo, engagementId: engagement.id, entityUnderstanding: 'Entity and operations understood',
    plannedAuditApproach: 'Risk-responsive audit approach', managerReviewerId: manager.id, partnerApproverId: partner.id,
    managerReviewDate: today(), partnerApprovalDate: today(), status: 'Approved'
  }, 'Tester');
}


async function createApprovedMateriality(ctx: Awaited<ReturnType<typeof context>>) {
  const { h, engagement, partner, manager } = ctx;
  const base = { ...emptyMateriality, engagementId: engagement.id, benchmark: 'Profit before tax', benchmarkAmount: 1000000, selectedPercentage: 5,
    performanceMaterialityPercentage: 75, clearlyTrivialPercentage: 5, rationaleForBenchmark: 'Stable profitability benchmark',
    rationaleForPercentage: 'Appropriate based on engagement risk', managerReviewerId: manager.id, partnerApproverId: partner.id,
    managerReviewDate: today(), partnerApprovalDate: today() };
  const draft = await h.services.materiality.save(base, 'Tester');
  const managerReview = await h.services.materiality.save({ ...base, status: 'Manager Review' }, 'Tester', draft.id);
  const partnerReview = await h.services.materiality.save({ ...base, status: 'Partner Review' }, 'Tester', managerReview.id);
  return h.services.materiality.save({ ...base, status: 'Approved' }, 'Tester', partnerReview.id);
}

async function createRequiredTeamAndMilestones(ctx: Awaited<ReturnType<typeof context>>) {
  const { h, engagement, partner, manager } = ctx;
  await h.services.team.save({ ...emptyTeam, engagementId: engagement.id, staffId: partner.id, assignmentRole: 'Partner', estimatedHours: 8, responsibilityArea: 'Overall direction' }, 'Tester');
  await h.services.team.save({ ...emptyTeam, engagementId: engagement.id, staffId: manager.id, assignmentRole: 'Manager', estimatedHours: 24, responsibilityArea: 'Planning and review' }, 'Tester');
  for (const [index, milestoneType] of REQUIRED_PLANNING_MILESTONES.entries()) {
    await h.services.planningMilestones.save({ ...emptyPlanningMilestone, engagementId: engagement.id, milestoneType, description: milestoneType, dueDate: future(index + 2), ownerId: manager.id }, 'Tester');
  }
}

async function makePhase2ABackup() {
  const ctx = await context('Planning');
  await createApprovedAcceptance(ctx);
  await createClearedIndependence(ctx);
  await createAcceptedLetter(ctx);
  await createApprovedMemo(ctx);
  await createApprovedMateriality(ctx);
  await createRequiredTeamAndMilestones(ctx);
  return { ctx, backup: ctx.h.services.backup.createBackup() };
}

function allFilters() { return { period: '', partnerId: '', managerId: '', service: '', clientType: '', engagementStatus: '' }; }

describe('Phase 2A Acceptance and Continuance', () => {
  it('106 creates an Acceptance record for an Audit engagement', async () => {
    const ctx = await context();
    const saved = await ctx.h.services.acceptance.save({ ...emptyAcceptance, engagementId: ctx.engagement.id }, 'Tester');
    expect(saved.engagementId).toBe(ctx.engagement.id); expect(await ctx.h.services.acceptance.forEngagement(ctx.engagement.id)).not.toBeNull();
  });
  it('107 approval requires mandatory fields', async () => {
    const ctx = await context();
    await expect(ctx.h.services.acceptance.save({ ...emptyAcceptance, engagementId: ctx.engagement.id, status: 'Approved' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/required for approval/i)]) });
  });
  it('108 rejection requires a reason', async () => {
    const ctx = await context();
    await expect(ctx.h.services.acceptance.save({ ...emptyAcceptance, engagementId: ctx.engagement.id, status: 'Rejected' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/rejection requires/i)]) });
  });
  it('109 enforces Acceptance status transitions', async () => {
    const ctx = await context();
    const draft = await ctx.h.services.acceptance.save({ ...emptyAcceptance, engagementId: ctx.engagement.id }, 'Tester');
    await expect(ctx.h.services.acceptance.save({ ...draft, status: 'Approved' }, 'Tester', draft.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/cannot transition/i)]) });
    const managerReview = await ctx.h.services.acceptance.save({ ...draft, status: 'Manager Review', managerReviewerId: ctx.manager.id }, 'Tester', draft.id);
    expect(managerReview.status).toBe('Manager Review');
  });
  it('110 enforces Manager and Partner separation and roles', async () => {
    const ctx = await context();
    await expect(ctx.h.services.acceptance.save({ ...emptyAcceptance, engagementId: ctx.engagement.id, managerReviewerId: ctx.partner.id, partnerApproverId: ctx.partner.id }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Manager reviewer|cannot be/i)]) });
  });
});

describe('Phase 2A Independence and Conflict', () => {
  it('111 requires threat description when a threat is Yes', async () => {
    const ctx = await context();
    await expect(ctx.h.services.independence.save({ ...emptyIndependence, engagementId: ctx.engagement.id, assessmentDate: today(), assessedById: ctx.manager.id, financialInterestThreat: 'Yes' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Threat Description/i)]) });
  });
  it('112 requires safeguards when a threat is Yes', async () => {
    const ctx = await context();
    await expect(ctx.h.services.independence.save({ ...emptyIndependence, engagementId: ctx.engagement.id, assessmentDate: today(), assessedById: ctx.manager.id, financialInterestThreat: 'Yes', threatDescription: 'Shareholding' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Safeguards/i)]) });
  });
  it('113 blocks unresolved conflict clearance', async () => {
    const ctx = await context();
    await expect(ctx.h.services.independence.save({ ...emptyIndependence, engagementId: ctx.engagement.id, assessmentDate: today(), assessedById: ctx.manager.id, conflictFound: 'Yes', managerReviewed: true, partnerCleared: true, status: 'Cleared' }, 'Tester')).rejects.toBeInstanceOf(ValidationError);
  });
  it('114 requires Manager review and Partner clearance before Cleared', async () => {
    const ctx = await context();
    await expect(ctx.h.services.independence.save({ ...emptyIndependence, engagementId: ctx.engagement.id, assessmentDate: today(), assessedById: ctx.manager.id, conclusion: 'Clear', status: 'Cleared' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Manager review/i), expect.stringMatching(/Partner clearance/i)]) });
  });
  it('115 creates a valid Cleared assessment and logs it', async () => {
    const ctx = await context(); const saved = await createClearedIndependence(ctx);
    expect(saved.status).toBe('Cleared'); expect((await ctx.h.services.activity.forEntity('Independence Assessment', saved.id)).length).toBeGreaterThan(0);
  });
});

describe('Phase 2A Engagement Letter', () => {
  it('116 validates letter date ordering', async () => {
    const ctx = await context();
    await expect(ctx.h.services.engagementLetters.save({ ...emptyEngagementLetter, engagementId: ctx.engagement.id, letterReference: 'EL-X', draftDate: '2026-06-20', sentToClientDate: '2026-06-19' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/cannot precede Draft/i)]) });
  });
  it('117 Accepted letter requires signatures and acceptance date', async () => {
    const ctx = await context();
    await expect(ctx.h.services.engagementLetters.save({ ...emptyEngagementLetter, engagementId: ctx.engagement.id, letterReference: 'EL-X', status: 'Accepted' }, 'Tester')).rejects.toBeInstanceOf(ValidationError);
  });
  it('118 keeps only one current Accepted letter and preserves superseded version', async () => {
    const ctx = await context(); const first = await createAcceptedLetter(ctx, 'EL-001', 1); const second = await createAcceptedLetter(ctx, 'EL-002', 2);
    expect((await ctx.h.repositories.engagementLetters.getById(first.id))?.status).toBe('Superseded');
    expect((await ctx.h.services.engagementLetters.currentAccepted(ctx.engagement.id))?.id).toBe(second.id);
    expect(await ctx.h.services.engagementLetters.forEngagement(ctx.engagement.id)).toHaveLength(2);
  });
  it('119 requires unique reference within an engagement', async () => {
    const ctx = await context(); await ctx.h.services.engagementLetters.save({ ...emptyEngagementLetter, engagementId: ctx.engagement.id, letterReference: 'EL-001' }, 'Tester');
    await expect(ctx.h.services.engagementLetters.save({ ...emptyEngagementLetter, engagementId: ctx.engagement.id, letterReference: 'el-001', letterVersion: 2 }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/unique/i)]) });
  });
});

describe('Phase 2A Planning Memorandum', () => {
  it('120 blocks memo work until Acceptance and Independence prerequisites are complete', async () => {
    const ctx = await context();
    await expect(ctx.h.services.planningMemos.save({ ...emptyPlanningMemo, engagementId: ctx.engagement.id, status: 'Draft' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Acceptance.*Approved/i), expect.stringMatching(/Independence.*Cleared/i)]) });
  });
  it('121 validates Manager review before Partner Review', async () => {
    const ctx = await context(); await createApprovedAcceptance(ctx); await createClearedIndependence(ctx);
    await expect(ctx.h.services.planningMemos.save({ ...emptyPlanningMemo, engagementId: ctx.engagement.id, status: 'Partner Review', partnerApproverId: ctx.partner.id }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/completed Manager review/i)]) });
  });
  it('122 requires Engagement Letter and approvals before final Planning approval', async () => {
    const ctx = await context(); await createApprovedAcceptance(ctx); await createClearedIndependence(ctx);
    await expect(ctx.h.services.planningMemos.save({ ...emptyPlanningMemo, engagementId: ctx.engagement.id, entityUnderstanding: 'Known', plannedAuditApproach: 'Approach', managerReviewerId: ctx.manager.id, partnerApproverId: ctx.partner.id, managerReviewDate: today(), partnerApprovalDate: today(), status: 'Approved' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Accepted Engagement Letter/i)]) });
  });
  it('123 Returned status requires review comments', async () => {
    const ctx = await context(); await createApprovedAcceptance(ctx); await createClearedIndependence(ctx);
    const memo = await ctx.h.services.planningMemos.save({ ...emptyPlanningMemo, engagementId: ctx.engagement.id, status: 'Manager Review', managerReviewerId: ctx.manager.id, managerReviewDate: today() }, 'Tester');
    await expect(ctx.h.services.planningMemos.save({ ...memo, status: 'Returned', notes: '' }, 'Tester', memo.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/review comments/i)]) });
  });
  it('124 approved memo is read-only and controlled reopen requires a reason', async () => {
    const ctx = await context(); await createApprovedAcceptance(ctx); await createClearedIndependence(ctx); await createAcceptedLetter(ctx); const memo = await createApprovedMemo(ctx);
    await expect(ctx.h.services.planningMemos.save({ ...memo, notes: 'Direct edit' }, 'Tester', memo.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/controlled reopen/i)]) });
    await expect(ctx.h.services.planningMemos.reopen(memo.id, '', 'Tester')).rejects.toBeInstanceOf(ValidationError);
    expect((await ctx.h.services.planningMemos.reopen(memo.id, 'Planning assumptions changed', 'Tester')).status).toBe('Returned');
  });
});

describe('Phase 2A Team, Timeline and Planning Gates', () => {
  it('125 validates planning team positive hours and date order', async () => {
    const ctx = await context();
    await expect(ctx.h.services.team.save({ ...emptyTeam, engagementId: ctx.engagement.id, staffId: ctx.manager.id, assignmentRole: 'Manager', estimatedHours: 0 }, 'Tester')).rejects.toBeInstanceOf(ValidationError);
    await expect(ctx.h.services.team.save({ ...emptyTeam, engagementId: ctx.engagement.id, staffId: ctx.manager.id, assignmentRole: 'Manager', startDate: '2026-06-20', endDate: '2026-06-19' }, 'Tester')).rejects.toBeInstanceOf(ValidationError);
  });
  it('126 validates critical milestone changes and completion date', async () => {
    const ctx = await context();
    const milestone = await ctx.h.services.planningMilestones.save({ ...emptyPlanningMilestone, engagementId: ctx.engagement.id, milestoneType: 'Planning Completion', description: 'Complete planning', dueDate: future(), ownerId: ctx.manager.id, priority: 'Critical' }, 'Tester');
    await expect(ctx.h.services.planningMilestones.save({ ...milestone, dueDate: future(20), changeReason: '' }, 'Tester', milestone.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/requires a reason/i)]) });
    await expect(ctx.h.services.planningMilestones.save({ ...milestone, status: 'Completed', completionDate: '' }, 'Tester', milestone.id)).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Completion Date/i)]) });
  });
  it('127 blocks transition to Planning with exact missing requirements', async () => {
    const ctx = await context('Approved');
    await expect(ctx.h.services.engagements.update(ctx.engagement.id, { ...ctx.engagement, status: 'Planning' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Acceptance.*missing/i), expect.stringMatching(/Independence.*missing/i)]) });
    const events = await ctx.h.services.activity.forEntity('Engagement', ctx.engagement.id); expect(events.some(item => /Blocked status transition/.test(item.changedFieldSummary))).toBe(true);
  });
  it('128 permits transition to Planning when all gate requirements are met', async () => {
    const ctx = await context('Approved'); await createApprovedAcceptance(ctx); await createClearedIndependence(ctx);
    const updated = await ctx.h.services.engagements.update(ctx.engagement.id, { ...ctx.engagement, status: 'Planning' }, 'Tester'); expect(updated.status).toBe('Planning');
  });
  it('129 blocks transition to Fieldwork when letter, memo, team or milestones are missing', async () => {
    const ctx = await context('Planning'); await createApprovedAcceptance(ctx); await createClearedIndependence(ctx);
    await expect(ctx.h.services.engagements.update(ctx.engagement.id, { ...ctx.engagement, status: 'Fieldwork' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Accepted Engagement Letter/i), expect.stringMatching(/Planning Memorandum/i), expect.stringMatching(/planning team/i), expect.stringMatching(/milestones/i)]) });
  });
  it('130 permits transition to Fieldwork when all planning gates are satisfied', async () => {
    const ctx = await context('Planning'); await createApprovedAcceptance(ctx); await createClearedIndependence(ctx); await createAcceptedLetter(ctx); await createApprovedMemo(ctx); await createApprovedMateriality(ctx); await createRequiredTeamAndMilestones(ctx);
    const updated = await ctx.h.services.engagements.update(ctx.engagement.id, { ...ctx.engagement, status: 'Fieldwork' }, 'Tester'); expect(updated.status).toBe('Fieldwork');
  });
  it('131 calculates Planning readiness from actual records', async () => {
    const ctx = await context('Planning'); const empty = await ctx.h.services.planningGates.readiness(ctx.engagement, 14); expect(empty.percentage).toBeLessThan(100); expect(empty.blockingItems.length).toBeGreaterThan(0);
    await createApprovedAcceptance(ctx); await createClearedIndependence(ctx); await createAcceptedLetter(ctx); await createApprovedMemo(ctx); await createApprovedMateriality(ctx); await createRequiredTeamAndMilestones(ctx);
    const ready = await ctx.h.services.planningGates.readiness(ctx.engagement, 14); expect(ready.percentage).toBe(100); expect(ready.blockingItems).toEqual([]); expect(ready.plannedHours).toBe(32);
  });
  it('132 calculates dashboard planning indicators using repository data and filters', async () => {
    const ctx = await context('Planning'); await createApprovedAcceptance(ctx); await createClearedIndependence(ctx); await createAcceptedLetter(ctx); await createApprovedMemo(ctx); await createApprovedMateriality(ctx); await createRequiredTeamAndMilestones(ctx);
    const summary = await ctx.h.services.dashboard.getSummary(allFilters(), 14); expect(summary.auditReadyForFieldwork).toBe(1);
    const excluded = await ctx.h.services.dashboard.getSummary({ ...allFilters(), service: 'Tax' }, 14); expect(excluded.auditReadyForFieldwork).toBe(0);
  });
  it.each(['Locked', 'Closed'] as const)('133 %s Audit engagement blocks all Phase 2A mutations and logs attempts', async status => {
    const ctx = await context(); const protectedEngagement = { ...ctx.engagement, status, recordVersion: ctx.engagement.recordVersion + 1 }; await ctx.h.repositories.engagements.update(protectedEngagement);
    await expect(ctx.h.services.acceptance.save({ ...emptyAcceptance, engagementId: protectedEngagement.id }, 'Tester')).rejects.toBeInstanceOf(ValidationError);
    await expect(ctx.h.services.planningMilestones.save({ ...emptyPlanningMilestone, engagementId: protectedEngagement.id, milestoneType: 'Planning Completion', description: 'X', dueDate: future() }, 'Tester')).rejects.toBeInstanceOf(ValidationError);
    expect((await ctx.h.services.activity.forEntity('Engagement', protectedEngagement.id)).filter(item => item.action === 'Lock Attempt').length).toBe(2);
  });
  it('134 prevents Phase 2A records on non-Audit engagements', async () => {
    const ctx = await context(); const nonAudit = { ...ctx.engagement, serviceType: 'Tax', engagementType: 'Tax Compliance', recordVersion: ctx.engagement.recordVersion + 1 }; await ctx.h.repositories.engagements.update(nonAudit);
    await expect(ctx.h.services.acceptance.save({ ...emptyAcceptance, engagementId: nonAudit.id }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/Only Audit engagements/i)]) });
  });
});

describe('Phase 2A Backup, Restore and Regression', () => {
  it('135 full backup includes all Phase 2A modules and per-module export works', async () => {
    const { ctx, backup } = await makePhase2ABackup();
    for (const key of [STORAGE_KEYS.acceptanceReviews, STORAGE_KEYS.independenceAssessments, STORAGE_KEYS.engagementLetters, STORAGE_KEYS.auditPlans, STORAGE_KEYS.planningMilestones]) expect(backup.data[key]).toBeDefined();
    const moduleBackup = ctx.h.services.backup.createBackup(STORAGE_KEYS.auditPlans); expect(Object.keys(moduleBackup.data)).toEqual([STORAGE_KEYS.auditPlans]);
  });
  it('136 restores Phase 2A records and preserves relationships', async () => {
    const { backup } = await makePhase2ABackup(); const target = createHarness(); const preview = target.services.backup.preview(backup, 'replace'); expect(preview.valid).toBe(true);
    const result = await target.services.backup.restore(backup, 'replace', 'Tester'); expect(result.rolledBack).toBe(false); expect(await target.repositories.auditPlans.list()).toHaveLength(1);
    const plan = (await target.repositories.auditPlans.list())[0]; expect(await target.repositories.engagements.getById(plan.engagementId)).not.toBeNull();
  });
  it('137 rejects missing Phase 2A relationships and invalid reviewer roles', async () => {
    const { backup } = await makePhase2ABackup();
    const missingOwner: BackupEnvelope = structuredClone(backup); (missingOwner.data[STORAGE_KEYS.planningMilestones][0] as Record<string, unknown>).ownerId = 'missing-staff';
    expect(createHarness().services.backup.preview(missingOwner, 'replace').errors.join(' ')).toMatch(/missing owner/i);
    const invalidReviewer: BackupEnvelope = structuredClone(backup); const manager = (invalidReviewer.data[STORAGE_KEYS.staff] as Array<Record<string, unknown>>).find(item => item.role === 'Manager')!; manager.role = 'Assistant';
    expect(createHarness().services.backup.preview(invalidReviewer, 'replace').errors.join(' ')).toMatch(/invalid Manager reviewer/i);
  });
  it('138 atomically rolls back Phase 2A modules on restore failure', async () => {
    const { backup } = await makePhase2ABackup(); const storage = new FailOnceStorage(); const target = createHarness(storage); const existing = await seedEngagement(target);
    const beforeEngagements = storage.getItem(STORAGE_KEYS.engagements); const beforePlans = storage.getItem(STORAGE_KEYS.auditPlans); storage.failKey = STORAGE_KEYS.planningMilestones;
    const result = await target.services.backup.restore(backup, 'replace', 'Tester'); expect(result.rolledBack && result.rollbackSuccessful).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.engagements)).toBe(beforeEngagements); expect(storage.getItem(STORAGE_KEYS.auditPlans)).toBe(beforePlans); expect(await target.repositories.engagements.getById(existing.id)).not.toBeNull(); expect(storage.getItem(result.preImportBackupKey)).toBeTruthy();
  });
  it('139 clearly rejects a Phase 1 schema backup without changing data', async () => {
    const target = createHarness(); const existing = await seedEngagement(target); const before = target.storage.getItem(STORAGE_KEYS.engagements);
    const { backup } = await makePhase2ABackup(); const legacy = structuredClone(backup); legacy.schemaVersion = '1.0'; legacy.settings.schemaVersion = '1.0'; legacy.meta.schemaVersion = '1.0';
    const preview = target.services.backup.preview(legacy, 'replace'); expect(preview.valid).toBe(false); expect(preview.errors.join(' ')).toMatch(/Phase 1 backup schema 1\.0/i); expect(target.storage.getItem(STORAGE_KEYS.engagements)).toBe(before); expect(await target.repositories.engagements.getById(existing.id)).not.toBeNull();
  });
});
