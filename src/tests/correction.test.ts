// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHarness, MemoryStorage, emptyContact, emptyDeadline, emptyEngagement, emptyTask, emptyTeam, seedActiveClient, seedEngagement, seedStaff } from './harness';
import { STORAGE_KEYS } from '../repositories/localStorage/keys';
import type { IStorageGateway } from '../repositories/interfaces/IStorageGateway';
import type { BackupEnvelope, Engagement, TaskStatus } from '../types/models';
import { createMetadata } from '../services/helpers';
import { neutralizeCsvFormula, toCsv } from '../utils/download';

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

const cloneBackup = (backup: BackupEnvelope): BackupEnvelope => structuredClone(backup);
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0,10); };

async function makeFullBackup() {
  const source = createHarness();
  const engagement = await seedEngagement(source);
  const assistant = await seedStaff(source, 'Assistant', 'A-9');
  await source.services.contacts.save({ ...emptyContact, clientId: engagement.clientId, name: 'Primary', isPrimary: true }, 'Tester');
  await source.services.team.save({ ...emptyTeam, engagementId: engagement.id, staffId: assistant.id, assignmentRole: 'Assistant' }, 'Tester');
  await source.services.tasks.save({ ...emptyTask, title: 'Work', taskType: 'Engagement', clientId: engagement.clientId, engagementId: engagement.id, assigneeId: assistant.id, dueDate: tomorrow() }, 'Tester');
  await source.services.deadlines.save({ ...emptyDeadline, clientId: engagement.clientId, engagementId: engagement.id, deadlineType: 'Reporting', description: 'Report', dueDate: tomorrow(), ownerId: assistant.id }, 'Tester');
  return source.services.backup.createBackup();
}

describe('P1 atomic restore and schema validation', () => {
  it('60 replace failure rolls back settings and multiple modules', async () => {
    const storage = new FailOnceStorage(); const target = createHarness(storage); const existing = await seedActiveClient(target, { legalName: 'Original' });
    const beforeSettings = JSON.stringify(target.services.settings.get()); const beforeClients = storage.getItem(STORAGE_KEYS.clients);
    const backup = await makeFullBackup(); storage.failKey = STORAGE_KEYS.tasks;
    const result = await target.services.backup.restore(backup, 'replace', 'Tester');
    expect(result.rolledBack).toBe(true); expect(result.rollbackSuccessful).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.clients)).toBe(beforeClients); expect(JSON.stringify(target.services.settings.get())).toBe(beforeSettings);
    expect((await target.repositories.clients.getById(existing.id))?.legalName).toBe('Original'); expect(storage.getItem(result.preImportBackupKey)).toBeTruthy();
  });
  it('61 merge failure performs complete rollback', async () => {
    const storage = new FailOnceStorage(); const target = createHarness(storage); await seedActiveClient(target, { legalName: 'Original Merge' });
    const before = new Map([STORAGE_KEYS.clients, STORAGE_KEYS.staff, STORAGE_KEYS.engagements].map(key => [key, storage.getItem(key)]));
    const backup = await makeFullBackup(); storage.failKey = STORAGE_KEYS.engagements;
    const result = await target.services.backup.restore(backup, 'merge', 'Tester');
    expect(result.rolledBack && result.rollbackSuccessful).toBe(true);
    for (const [key, value] of before) expect(storage.getItem(key)).toBe(value);
  });
  it.each([
    ['missing required field', (b: BackupEnvelope) => { delete (b.data[STORAGE_KEYS.clients][0] as Record<string, unknown>).legalName; }],
    ['invalid status', (b: BackupEnvelope) => { (b.data[STORAGE_KEYS.clients][0] as Record<string, unknown>).status = 'BROKEN'; }],
    ['invalid number', (b: BackupEnvelope) => { (b.data[STORAGE_KEYS.staff][0] as Record<string, unknown>).weeklyCapacityHours = -2; }],
    ['invalid date', (b: BackupEnvelope) => { (b.data[STORAGE_KEYS.engagements][0] as Record<string, unknown>).startDate = 'not-date'; }],
    ['invalid audit metadata', (b: BackupEnvelope) => { (b.data[STORAGE_KEYS.clients][0] as Record<string, unknown>).recordVersion = 0; }],
    ['invalid settings', (b: BackupEnvelope) => { b.settings.upcomingDeadlineDays = 0; }]
  ])('62 rejects %s', async (_name, mutate) => {
    const h = createHarness(); const backup = cloneBackup(await makeFullBackup()); mutate(backup); backup.checksum = 'invalid-after-mutation';
    const preview = h.services.backup.preview(backup, 'replace'); expect(preview.valid).toBe(false); expect(preview.errors.length).toBeGreaterThan(0);
  });
  it('63 rejects duplicate IDs inside a module', async () => {
    const h = createHarness(); const backup = cloneBackup(await makeFullBackup()); backup.data[STORAGE_KEYS.clients].push(structuredClone(backup.data[STORAGE_KEYS.clients][0]));
    expect(h.services.backup.preview(backup, 'replace').errors.some(e => /duplicate id/i.test(e))).toBe(true);
  });
  it('64 distinguishes full and per-module backups and rejects missing modules', async () => {
    const source = createHarness(); await seedActiveClient(source); const moduleBackup = source.services.backup.createBackup(STORAGE_KEYS.clients);
    expect(moduleBackup.backupType).toBe('module'); expect(Object.keys(moduleBackup.data)).toEqual([STORAGE_KEYS.clients]);
    const full = source.services.backup.createBackup(); delete full.data[STORAGE_KEYS.tasks];
    expect(source.services.backup.preview(full).errors.some(e => /missing required modules/i.test(e))).toBe(true);
  });
});

describe('P1 relationship and locking protection', () => {
  it('65 rejects missing client, engagement and staff relationships', async () => {
    const h = createHarness(); const backup = cloneBackup(await makeFullBackup());
    (backup.data[STORAGE_KEYS.clientContacts][0] as Record<string, unknown>).clientId = 'missing';
    (backup.data[STORAGE_KEYS.engagementTeam][0] as Record<string, unknown>).engagementId = 'missing';
    (backup.data[STORAGE_KEYS.tasks][0] as Record<string, unknown>).assigneeId = 'missing';
    const preview = h.services.backup.preview(backup, 'replace');
    expect(preview.errors.join(' ')).toMatch(/missing client/i); expect(preview.errors.join(' ')).toMatch(/missing engagement/i); expect(preview.errors.join(' ')).toMatch(/missing assignee|missing staff/i);
  });
  it('66 rejects invalid Partner and Manager roles', async () => {
    const h = createHarness(); const backup = cloneBackup(await makeFullBackup()); const engagement = backup.data[STORAGE_KEYS.engagements][0] as Record<string, unknown>;
    const assistant = (backup.data[STORAGE_KEYS.staff] as Array<Record<string, unknown>>).find(s => s.role === 'Assistant')!;
    engagement.responsiblePartnerId = assistant.id; engagement.responsibleManagerId = assistant.id;
    expect(h.services.backup.preview(backup, 'replace').errors.join(' ')).toMatch(/invalid responsible Partner/i);
  });
  it('67 accepts valid per-module merge relationship using current parent', async () => {
    const source = createHarness(); const client = await seedActiveClient(source); await source.services.contacts.save({ ...emptyContact, clientId: client.id, name: 'Contact' }, 'Tester');
    const backup = source.services.backup.createBackup(STORAGE_KEYS.clientContacts);
    const target = createHarness(); await target.repositories.clients.create(client);
    expect(target.services.backup.preview(backup, 'merge').valid).toBe(true);
  });
  it('68 allows archived historical staff references', async () => {
    const h = createHarness(); const backup = cloneBackup(await makeFullBackup()); const staff = (backup.data[STORAGE_KEYS.staff] as Array<Record<string, unknown>>).find(s => s.role === 'Assistant')!;
    staff.isActive = false; staff.status = 'Inactive';
    const task = backup.data[STORAGE_KEYS.tasks][0] as Record<string, unknown>; task.status = 'Completed'; task.completionDate = tomorrow();
    const team = backup.data[STORAGE_KEYS.engagementTeam][0] as Record<string, unknown>; team.isActive = false; team.status = 'Inactive';
    expect(h.services.backup.preview(backup, 'replace').errors.filter(e => /inactive assignee|active team/i.test(e))).toEqual([]);
  });
  it.each(['Locked','Closed'] as const)('69 %s engagement blocks team, task and deadline mutations and logs attempts', async status => {
    const h = createHarness(); const engagement = await seedEngagement(h); const assistant = await seedStaff(h, 'Assistant', `A-${status}`);
    const locked: Engagement = { ...engagement, status, recordVersion: engagement.recordVersion + 1 }; await h.repositories.engagements.update(locked);
    await expect(h.services.team.save({ ...emptyTeam, engagementId: locked.id, staffId: assistant.id }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/read-only/i)]) });
    await expect(h.services.tasks.save({ ...emptyTask, title: 'Blocked', taskType: 'Engagement', engagementId: locked.id, clientId: locked.clientId, dueDate: tomorrow() }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/read-only/i)]) });
    await expect(h.services.deadlines.save({ ...emptyDeadline, clientId: locked.clientId, engagementId: locked.id, deadlineType: 'X', description: 'X', dueDate: tomorrow() }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/read-only/i)]) });
    expect((await h.services.activity.forEntity('Engagement', locked.id)).filter(e => e.action === 'Lock Attempt').length).toBe(3);
  });
});

describe('P2 task, activity, dashboard, contacts and CSV hardening', () => {
  it('70 enforces task transition map and status requirements', async () => {
    const h = createHarness(); const task = await h.services.tasks.save({ ...emptyTask, title: 'Move' }, 'Tester');
    await expect(h.services.tasks.changeStatus(task.id, 'Completed', 'Tester', { completionDate: tomorrow() })).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/cannot transition/i)]) });
    const assigned = await h.services.tasks.changeStatus(task.id, 'Assigned', 'Tester');
    const progress = await h.services.tasks.changeStatus(assigned.id, 'In Progress', 'Tester');
    await expect(h.services.tasks.changeStatus(progress.id, 'Blocked', 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/blocker reason/i)]) });
    const blocked = await h.services.tasks.changeStatus(progress.id, 'Blocked', 'Tester', { blockerReason: 'Waiting' }); expect(blocked.status).toBe('Blocked');
    expect((await h.services.activity.forEntity('Task', task.id)).some(e => e.action === 'Status Change')).toBe(true);
  });
  it('71 update summaries name changed fields and no-change update does not log', async () => {
    const h = createHarness(); const client = await seedActiveClient(h); const before = (await h.services.activity.recent()).length;
    await h.services.clients.update(client.id, { ...client, tradeName: 'Changed Trade' }, 'Tester');
    const events = await h.services.activity.forEntity('Client', client.id); expect(events.some(event => /Trade Name:.*Changed Trade/.test(event.changedFieldSummary))).toBe(true);
    const count = (await h.services.activity.recent()).length; const latest = await h.services.clients.get(client.id); await h.services.clients.update(client.id, { ...latest! }, 'Tester');
    expect((await h.services.activity.recent()).length).toBe(count); expect(count).toBeGreaterThan(before);
  });
  it('72 primary reassignment logs both affected contacts', async () => {
    const h = createHarness(); const client = await seedActiveClient(h); const first = await h.services.contacts.save({ ...emptyContact, clientId: client.id, name: 'First', isPrimary: true }, 'Tester');
    const second = await h.services.contacts.save({ ...emptyContact, clientId: client.id, name: 'Second', isPrimary: true }, 'Tester');
    expect((await h.services.activity.forEntity('Client Contact', first.id)).some(event => /Yes → No/.test(event.changedFieldSummary))).toBe(true);
    expect((await h.services.activity.forEntity('Client Contact', second.id))[0].changedFieldSummary).toMatch(/primary/i);
  });
  it('73 archived client rejects new contact while historical contact remains visible', async () => {
    const h = createHarness(); const client = await seedActiveClient(h); await h.services.contacts.save({ ...emptyContact, clientId: client.id, name: 'History' }, 'Tester'); await h.services.clients.archive(client.id, 'Tester');
    await expect(h.services.contacts.save({ ...emptyContact, clientId: client.id, name: 'New' }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/archived/i)]) });
    expect(await h.services.contacts.forClient(client.id)).toHaveLength(1);
  });
  it('74 dashboard filters all related outputs and reset restores totals', async () => {
    const h = createHarness(); const first = await seedEngagement(h, { financialPeriodEnd: '2025-12-31' });
    const empty = { period:'2099',partnerId:'',managerId:'',service:'',clientType:'',engagementStatus:'' };
    const filtered = await h.services.dashboard.getSummary(empty, 14); expect(filtered.activeClients).toBe(0); expect(filtered.activeEngagements).toBe(0); expect(filtered.recentActivity).toEqual([]);
    const all = await h.services.dashboard.getSummary({ period:'',partnerId:'',managerId:'',service:'',clientType:'',engagementStatus:'' },14); expect(all.activeClients).toBe(1); expect(all.recentEngagements[0].id).toBe(first.id); expect(all.activeStaff).toBe(2);
  });
  it.each(['=2+2','+SUM(A1:A2)','-1+2','@cmd'])("75 neutralises formula-like CSV value %s", value => { expect(neutralizeCsvFormula(value)).toBe(`'${value}`); });
  it('76 preserves normal, quoted, comma, newline and Bangla CSV text', () => {
    const csv = toCsv([{ name: 'বাংলা, "নাম"\nদুই', safe: 'Normal' }]);
    expect(csv).toContain('বাংলা, ""নাম""\nদুই'); expect(csv).toContain('"Normal"');
  });
});


describe('Additional correction acceptance', () => {
  it('78 rejects an unknown malformed record shape', async () => {
    const h = createHarness(); const backup = cloneBackup(await makeFullBackup());
    backup.data[STORAGE_KEYS.clients].push({ id: 'malformed-only' } as never);
    expect(h.services.backup.preview(backup, 'replace').errors.join(' ')).toMatch(/required|invalid/i);
  });
  it('79 blocks financial summary updates on Locked engagements and logs the attempt', async () => {
    const h = createHarness(); const engagement = await seedEngagement(h);
    const locked: Engagement = { ...engagement, status: 'Locked', recordVersion: engagement.recordVersion + 1 };
    await h.repositories.engagements.update(locked);
    await expect(h.services.engagements.updateFinancial(locked.id, { ...locked.financial, amountBilled: 100 }, 'Tester')).rejects.toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/read-only/i)]) });
    expect((await h.services.activity.forEntity('Engagement', locked.id)).some(event => event.action === 'Lock Attempt')).toBe(true);
  });
});
