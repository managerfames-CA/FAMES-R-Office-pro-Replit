// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHarness, emptyClient, emptyDeadline, emptyEngagement, emptyStaff, emptyTask, emptyTeam, seedActiveClient, seedEngagement, seedStaff } from './harness';
import { ValidationError } from '../utils/errors';
import { createMetadata } from '../services/helpers';
import type { Client, EngagementDeadline } from '../types/models';
import { STORAGE_KEYS } from '../repositories/localStorage/keys';

function yesterday(): string { const date = new Date(); date.setDate(date.getDate() - 1); return date.toISOString().slice(0, 10); }
function tomorrow(): string { const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); }

describe('Client management', () => {
  it('1 creates a client', async () => {
    const h = createHarness(); const client = await h.services.clients.create({ ...emptyClient, clientCode: 'cl 1', legalName: 'Acme Limited' }, 'Tester');
    expect(client.clientCode).toBe('CL1'); expect((await h.services.clients.list())).toHaveLength(1);
  });
  it('2 requires legal name', async () => {
    const h = createHarness(); await expect(h.services.clients.create({ ...emptyClient, clientCode: 'CL-1' }, 'Tester')).rejects.toBeInstanceOf(ValidationError);
  });
  it('3 prevents duplicate client code', async () => {
    const h = createHarness(); await h.services.clients.create({ ...emptyClient, clientCode: 'CL-1', legalName: 'One' }, 'Tester');
    await expect(h.services.clients.create({ ...emptyClient, clientCode: 'cl-1', legalName: 'Two' }, 'Tester')).rejects.toBeInstanceOf(ValidationError);
  });
  it('4 requires duplicate override reason', async () => {
    const h = createHarness(); await h.services.clients.create({ ...emptyClient, clientCode: 'CL-1', legalName: 'Same Name' }, 'Tester');
    await expect(h.services.clients.create({ ...emptyClient, clientCode: 'CL-2', legalName: 'same  name' }, 'Tester')).rejects.toBeInstanceOf(ValidationError);
  });
  it('5 accepts duplicate when override reason is present and logs it', async () => {
    const h = createHarness(); await h.services.clients.create({ ...emptyClient, clientCode: 'CL-1', legalName: 'Same Name' }, 'Tester');
    await h.services.clients.create({ ...emptyClient, clientCode: 'CL-2', legalName: 'Same Name', duplicateOverrideReason: 'Different legal entity' }, 'Tester');
    expect((await h.services.activity.recent()).some(event => event.action === 'Duplicate Override')).toBe(true);
  });
  it('6 normalises TIN BIN and registration number', async () => {
    const h = createHarness(); const client = await h.services.clients.create({ ...emptyClient, clientCode: 'CL-1', legalName: 'Normalised', tin: ' 12-34 ', bin: 'ab 12', registrationNumber: 'r/55' }, 'Tester');
    expect(client.tin).toBe('1234'); expect(client.bin).toBe('AB12'); expect(client.registrationNumber).toBe('R55');
  });
  it('7 archives without deleting history', async () => {
    const h = createHarness(); const client = await seedActiveClient(h); await h.services.clients.archive(client.id, 'Tester');
    expect(await h.services.clients.list()).toHaveLength(0); expect((await h.services.clients.list(true))[0].isDeleted).toBe(true);
  });
});

describe('Client contacts', () => {
  it('8 creates a contact', async () => {
    const h = createHarness(); const client = await seedActiveClient(h); const contact = await h.services.contacts.save({ clientId: client.id, name: 'Finance Contact', designation: '', department: '', email: 'a@b.com', phone: '', communicationPreference: 'Email', isPrimary: false, isActive: true, status: 'Active', notes: '' }, 'Tester');
    expect(contact.email).toBe('a@b.com');
  });
  it('9 enforces one primary contact per client', async () => {
    const h = createHarness(); const client = await seedActiveClient(h);
    const first = await h.services.contacts.save({ clientId: client.id, name: 'First', designation: '', department: '', email: '', phone: '', communicationPreference: 'Email', isPrimary: true, isActive: true, status: 'Active', notes: '' }, 'Tester');
    await h.services.contacts.save({ clientId: client.id, name: 'Second', designation: '', department: '', email: '', phone: '', communicationPreference: 'Email', isPrimary: true, isActive: true, status: 'Active', notes: '' }, 'Tester');
    expect((await h.repositories.clientContacts.getById(first.id))?.isPrimary).toBe(false);
  });
  it('10 rejects invalid email', async () => {
    const h = createHarness(); const client = await seedActiveClient(h);
    await expect(h.services.contacts.save({ clientId: client.id, name: 'Bad Email', designation: '', department: '', email: 'bad', phone: '', communicationPreference: 'Email', isPrimary: false, isActive: true, status: 'Active', notes: '' }, 'Tester')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('Staff and engagement team', () => {
  it('11 creates staff', async () => { const h = createHarness(); const staff = await h.services.staff.save({ ...emptyStaff, staffCode: 'S-1', fullName: 'Staff One' }, 'Tester'); expect(staff.fullName).toBe('Staff One'); });
  it('12 prevents duplicate staff code', async () => { const h = createHarness(); await h.services.staff.save({ ...emptyStaff, staffCode: 'S-1', fullName: 'One' }, 'Tester'); await expect(h.services.staff.save({ ...emptyStaff, staffCode: 's-1', fullName: 'Two' }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('13 prevents inactive staff assignment', async () => { const h = createHarness(); const engagement = await seedEngagement(h); const inactive = await seedStaff(h, 'Assistant', 'A-1', false); await expect(h.services.team.save({ ...emptyTeam, engagementId: engagement.id, staffId: inactive.id, assignmentRole: 'Assistant', estimatedHours: 5 }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('14 creates a valid team assignment', async () => { const h = createHarness(); const engagement = await seedEngagement(h); const assistant = await seedStaff(h, 'Assistant', 'A-1'); const assignment = await h.services.team.save({ ...emptyTeam, engagementId: engagement.id, staffId: assistant.id, assignmentRole: 'Assistant', estimatedHours: 5 }, 'Tester'); expect(assignment.estimatedHours).toBe(5); });
  it('15 prevents duplicate active team assignment', async () => { const h = createHarness(); const engagement = await seedEngagement(h); const assistant = await seedStaff(h, 'Assistant', 'A-1'); const input = { ...emptyTeam, engagementId: engagement.id, staffId: assistant.id, assignmentRole: 'Assistant', estimatedHours: 5 }; await h.services.team.save(input, 'Tester'); await expect(h.services.team.save(input, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('16 calculates workload summary', async () => { const h = createHarness(); const engagement = await seedEngagement(h); const assistant = await seedStaff(h, 'Assistant', 'A-1'); await h.services.team.save({ ...emptyTeam, engagementId: engagement.id, staffId: assistant.id, assignmentRole: 'Assistant', estimatedHours: 7 }, 'Tester'); expect(await h.services.team.workload(assistant.id)).toBe(7); });
});

describe('Engagement management', () => {
  it('17 creates an audit engagement', async () => { const h = createHarness(); const engagement = await seedEngagement(h); expect(engagement.serviceType).toBe('Audit'); });
  it('18 blocks inactive client engagement', async () => { const h = createHarness(); const client = await h.services.clients.create({ ...emptyClient, clientCode: 'CL-1', legalName: 'Inactive', status: 'Inactive' }, 'Tester'); const partner = await seedStaff(h, 'Partner', 'P-1'); const manager = await seedStaff(h, 'Manager', 'M-1'); await expect(h.services.engagements.create({ ...emptyEngagement, engagementCode: 'E-1', clientId: client.id, engagementType: 'Audit', serviceType: 'Audit', responsiblePartnerId: partner.id, responsibleManagerId: manager.id }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('19 blocks rejected client engagement', async () => { const h = createHarness(); const client = await h.services.clients.create({ ...emptyClient, clientCode: 'CL-1', legalName: 'Rejected', status: 'Rejected' }, 'Tester'); await expect(h.services.engagements.create({ ...emptyEngagement, engagementCode: 'E-1', clientId: client.id, engagementType: 'Other', serviceType: 'Tax' }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('20 prevents duplicate engagement', async () => { const h = createHarness(); const first = await seedEngagement(h); await expect(h.services.engagements.create({ ...emptyEngagement, engagementCode: 'ENG-0002', clientId: first.clientId, engagementType: first.engagementType, serviceType: first.serviceType, financialPeriodStart: first.financialPeriodStart, financialPeriodEnd: first.financialPeriodEnd, responsiblePartnerId: first.responsiblePartnerId, responsibleManagerId: first.responsibleManagerId }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('21 allows duplicate engagement with reason', async () => { const h = createHarness(); const first = await seedEngagement(h); const duplicate = await h.services.engagements.create({ ...emptyEngagement, engagementCode: 'ENG-0002', clientId: first.clientId, engagementType: first.engagementType, serviceType: first.serviceType, financialPeriodStart: first.financialPeriodStart, financialPeriodEnd: first.financialPeriodEnd, responsiblePartnerId: first.responsiblePartnerId, responsibleManagerId: first.responsibleManagerId, duplicateOverrideReason: 'Separate scope' }, 'Tester'); expect(duplicate.engagementCode).toBe('ENG-0002'); });
  it('22 validates allowed transition', async () => { const h = createHarness(); expect(h.services.engagements.canTransition('Draft', 'Acceptance Pending')).toBe(true); });
  it('23 rejects unsupported transition', async () => { const h = createHarness(); const engagement = await seedEngagement(h); await expect(h.services.engagements.update(engagement.id, { ...engagement, status: 'Fieldwork' }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('24 prevents locked engagement modification', async () => { const h = createHarness(); const engagement = await seedEngagement(h); await h.repositories.engagements.update({ ...engagement, status: 'Locked' }); await expect(h.services.engagements.update(engagement.id, { ...engagement, status: 'Locked', notes: 'edit' }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('25 automatically activates listed PIE workflow', async () => { const h = createHarness(); const client = await seedActiveClient(h, { isListedPie: true }); const partner = await seedStaff(h, 'Partner', 'P-1'); const manager = await seedStaff(h, 'Manager', 'M-1'); const engagement = await h.services.engagements.create({ ...emptyEngagement, engagementCode: 'E-1', clientId: client.id, engagementType: 'Audit', serviceType: 'Audit', responsiblePartnerId: partner.id, responsibleManagerId: manager.id }, 'Tester'); expect(engagement.listedPieWorkflowRequired).toBe(true); });
  it('26 calculates outstanding amount', async () => { const h = createHarness(); const client = await seedActiveClient(h); const engagement = await h.services.engagements.create({ ...emptyEngagement, engagementCode: 'E-1', clientId: client.id, engagementType: 'Tax', serviceType: 'Tax', financial: { ...emptyEngagement.financial, amountBilled: 1000, amountCollected: 300 } }, 'Tester'); expect(engagement.financial.outstandingAmount).toBe(700); });
  it('27 prevents collected amount exceeding billed', async () => { const h = createHarness(); const client = await seedActiveClient(h); await expect(h.services.engagements.create({ ...emptyEngagement, engagementCode: 'E-1', clientId: client.id, engagementType: 'Tax', serviceType: 'Tax', financial: { ...emptyEngagement.financial, amountBilled: 100, amountCollected: 101 } }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
});

describe('Tasks and deadlines', () => {
  it('28 creates an internal task', async () => { const h = createHarness(); const task = await h.services.tasks.save({ ...emptyTask, title: 'Internal admin' }, 'Tester'); expect(task.title).toBe('Internal admin'); });
  it('29 requires client for client task', async () => { const h = createHarness(); await expect(h.services.tasks.save({ ...emptyTask, title: 'Client task', taskType: 'Client', dueDate: tomorrow() }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('30 requires due date for engagement task', async () => { const h = createHarness(); const engagement = await seedEngagement(h); await expect(h.services.tasks.save({ ...emptyTask, title: 'Engagement task', taskType: 'Engagement', engagementId: engagement.id }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('31 requires blocker reason', async () => { const h = createHarness(); await expect(h.services.tasks.save({ ...emptyTask, title: 'Blocked', status: 'Blocked' }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('32 requires completion date', async () => { const h = createHarness(); await expect(h.services.tasks.save({ ...emptyTask, title: 'Done', status: 'Completed' }, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('33 calculates overdue automatically', async () => { const h = createHarness(); const task = await h.services.tasks.save({ ...emptyTask, title: 'Late', dueDate: yesterday() }, 'Tester'); expect(h.services.tasks.isOverdue(task)).toBe(true); expect(task.status).toBe('Backlog'); });
  it('34 prevents duplicate task warning key', async () => { const h = createHarness(); const engagement = await seedEngagement(h); const assistant = await seedStaff(h, 'Assistant', 'A-1'); const input = { ...emptyTask, title: 'Same', taskType: 'Engagement' as const, engagementId: engagement.id, clientId: engagement.clientId, assigneeId: assistant.id, dueDate: tomorrow() }; await h.services.tasks.save(input, 'Tester'); await expect(h.services.tasks.save(input, 'Tester')).rejects.toBeInstanceOf(ValidationError); });
  it('35 requires reason when changing critical deadline', async () => { const h = createHarness(); const client = await seedActiveClient(h); const deadline = await h.services.deadlines.save({ ...emptyDeadline, clientId: client.id, deadlineType: 'Regulatory', description: 'Critical filing', dueDate: tomorrow(), priority: 'Critical' }, 'Tester'); const next = new Date(); next.setDate(next.getDate() + 2); await expect(h.services.deadlines.save({ ...deadline, dueDate: next.toISOString().slice(0,10), changeReason: '' }, 'Tester', deadline.id)).rejects.toBeInstanceOf(ValidationError); });
  it('36 calculates deadline overdue', async () => { const h = createHarness(); const client = await seedActiveClient(h); const deadline = await h.services.deadlines.save({ ...emptyDeadline, clientId: client.id, deadlineType: 'Tax', description: 'Late filing', dueDate: yesterday() }, 'Tester'); expect(h.services.deadlines.isOverdue(deadline)).toBe(true); });
});

describe('Dashboard, repository and settings', () => {
  it('37 calculates dashboard values from repository data', async () => { const h = createHarness(); await seedEngagement(h); await h.services.tasks.save({ ...emptyTask, title: 'Late', dueDate: yesterday() }, 'Tester'); const summary = await h.services.dashboard.getSummary({ period:'',partnerId:'',managerId:'',service:'',clientType:'',engagementStatus:'' }, 14); expect(summary.activeClients).toBe(1); expect(summary.activeEngagements).toBe(1); expect(summary.overdueTasks).toBe(1); });
  it('38 empty repository returns empty state data', async () => { const h = createHarness(); const summary = await h.services.dashboard.getSummary({ period:'',partnerId:'',managerId:'',service:'',clientType:'',engagementStatus:'' }, 14); expect(summary.activeClients).toBe(0); expect(summary.recentEngagements).toEqual([]); });
  it('39 repository archives and restores records', async () => { const h = createHarness(); const record: Client = { ...createMetadata('Active','Tester'), ...emptyClient, clientCode:'C1',legalName:'Repo' }; await h.repositories.clients.create(record); await h.repositories.clients.archive(record.id,'Tester'); expect(await h.repositories.clients.list()).toHaveLength(0); await h.repositories.clients.restore(record.id,'Tester'); expect(await h.repositories.clients.list()).toHaveLength(1); });
  it('40 repository rejects corrupt local data', async () => { const h = createHarness(); h.storage.setItem(STORAGE_KEYS.clients,'not-json'); await expect(h.repositories.clients.list()).rejects.toThrow(/corrupt/i); });
  it('41 validates app settings', () => { const h = createHarness(); const settings = h.services.settings.get(); expect(() => h.services.settings.save({ ...settings, upcomingDeadlineDays: 0 })).toThrow(ValidationError); });
  it('42 generates unique numbering', () => { const h = createHarness(); expect(h.services.settings.generateNextCode('client',['CL-0001','CL-0002'])).toBe('CL-0003'); });
});

describe('Backup and restore', () => {
  it('43 exports JSON backup with checksum', async () => { const h = createHarness(); await seedActiveClient(h); const backup = h.services.backup.createBackup(); expect(backup.moduleCounts[STORAGE_KEYS.clients]).toBe(1); expect(backup.checksum).toBeTruthy(); expect(h.services.backup.preview(backup).checksumMatches).toBe(true); });
  it('44 creates valid restore preview', async () => { const h = createHarness(); await seedActiveClient(h); const preview = h.services.backup.preview(h.services.backup.createBackup()); expect(preview.valid).toBe(true); expect(preview.checksumMatches).toBe(true); });
  it('45 rejects invalid backup text', () => { const h = createHarness(); expect(() => h.services.backup.parse('{bad')).toThrow(/Invalid backup/); });
  it('46 rejects unsupported schema version', () => { const h = createHarness(); const backup = h.services.backup.createBackup(); const preview = h.services.backup.preview({ ...backup, schemaVersion: '99' }); expect(preview.valid).toBe(false); });
  it('47 restores records in merge mode', async () => { const source = createHarness(); const client = await seedActiveClient(source); const backup = source.services.backup.createBackup(); const target = createHarness(); const result = await target.services.backup.restore(backup,'merge','Tester'); expect(result.successCount).toBeGreaterThan(0); expect((await target.repositories.clients.getById(client.id))?.legalName).toBe('Example Client'); });
  it('48 preserves relationships in backup', async () => { const h = createHarness(); const engagement = await seedEngagement(h); const deadline: EngagementDeadline = await h.services.deadlines.save({ ...emptyDeadline, clientId: engagement.clientId, engagementId: engagement.id, deadlineType:'Reporting',description:'Issue report',dueDate:tomorrow() },'Tester'); const backup = h.services.backup.createBackup(); const record = (backup.data[STORAGE_KEYS.engagementDeadlines] as EngagementDeadline[]).find(item => item.id === deadline.id); expect(record?.engagementId).toBe(engagement.id); expect(record?.clientId).toBe(engagement.clientId); });
  it('49 reports merge conflicts without overwriting', async () => { const h = createHarness(); const client = await seedActiveClient(h); const backup = h.services.backup.createBackup(); const result = await h.services.backup.restore(backup,'merge','Tester'); expect(result.conflictCount).toBeGreaterThan(0); expect((await h.repositories.clients.getById(client.id))?.legalName).toBe('Example Client'); });
});
