import type { IRepository } from '../repositories/interfaces/IRepository';
import type { ClientContact, DocumentRequest, DocumentRequestItem, DocumentRequestReminder, Engagement, Staff, WorkingPaper } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';
import { requireMutableAuditEngagement } from './auditPlanningGuard';
import { isPastDue } from '../utils/dates';

export type DocumentRequestInput = Omit<DocumentRequest, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;
export type DocumentRequestItemInput = Omit<DocumentRequestItem, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;
export type DocumentRequestReminderInput = Omit<DocumentRequestReminder, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class DocumentRequestService {
  constructor(
    private readonly requests: IRepository<DocumentRequest>, private readonly items: IRepository<DocumentRequestItem>, private readonly reminders: IRepository<DocumentRequestReminder>,
    private readonly engagements: IRepository<Engagement>, private readonly contacts: IRepository<ClientContact>, private readonly staff: IRepository<Staff>,
    private readonly workingPapers: IRepository<WorkingPaper>, private readonly activity: ActivityService
  ) {}

  async saveRequest(input: DocumentRequestInput, operatorName: string, id?: string): Promise<DocumentRequest> {
    const engagement = await requireMutableAuditEngagement(this.engagements, this.activity, input.engagementId, operatorName, 'document request change');
    const existing = id ? await this.requests.getById(id) : null;
    if (id && !existing) throw new AppError('Document request was not found.', 'NOT_FOUND');
    const errors: string[] = [];
    if (!input.requestReference.trim()) errors.push('Request Reference is required.');
    if (!input.requestTitle.trim()) errors.push('Request Title is required.');
    if (input.clientContactId) {
      const contact = await this.contacts.getById(input.clientContactId);
      if (!contact || contact.isDeleted || !contact.isActive || contact.clientId !== engagement.clientId) errors.push('Client Contact must be an active contact of the engagement client.');
    }
    if (input.responsibleStaffId) {
      const member = await this.staff.getById(input.responsibleStaffId);
      if (!member || member.isDeleted || !member.isActive) errors.push('Responsible Staff must be active.');
    }
    const requestItems = id ? (await this.items.list()).filter(item => item.requestId === id) : [];
    if (input.status === 'Sent') {
      if (!input.sentDate) errors.push('Sent status requires Sent Date.');
      if (requestItems.length === 0) errors.push('Sent status requires at least one request item.');
    }
    if (input.status === 'Waived' && !input.waiverReason.trim()) errors.push('Waiver requires a reason.');
    if (input.status === 'Closed' && requestItems.some(item => !['Accepted', 'Waived'].includes(item.status))) errors.push('Only requests with all items Accepted or Waived may be closed.');
    const all = await this.requests.list({ includeDeleted: true });
    if (all.some(item => item.id !== id && !item.isDeleted && item.engagementId === input.engagementId && item.requestReference.trim().toLowerCase() === input.requestReference.trim().toLowerCase())) errors.push('Request Reference must be unique within the engagement.');
    if (errors.length) throw new ValidationError('Document request could not be saved.', errors);
    const normalized = { ...input, requestReference: input.requestReference.trim(), requestTitle: input.requestTitle.trim(), waiverReason: input.waiverReason.trim(), notes: input.notes.trim() };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.requests.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Document Request', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName, reason: saved.status === 'Waived' ? saved.waiverReason : '' });
      return saved;
    }
    const saved = await this.requests.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Document Request', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: `Document request ${saved.requestReference} created`, operatorName });
    return saved;
  }

  async saveItem(input: DocumentRequestItemInput, operatorName: string, id?: string): Promise<DocumentRequestItem> {
    const request = await this.requests.getById(input.requestId);
    if (!request || request.isDeleted) throw new ValidationError('Document request item could not be saved.', ['Parent Document Request was not found.']);
    const engagement = await requireMutableAuditEngagement(this.engagements, this.activity, request.engagementId, operatorName, 'document request item change');
    const existing = id ? await this.items.getById(id) : null;
    if (id && !existing) throw new AppError('Document request item was not found.', 'NOT_FOUND');
    const errors: string[] = [];
    if (!input.itemCode.trim()) errors.push('Item Code is required.');
    if (!input.description.trim()) errors.push('Description is required.');
    if (!Number.isInteger(input.version) || input.version <= 0) errors.push('Version must be a positive integer.');
    if (['Received', 'Under Review', 'Accepted', 'Rejected', 'Resubmission Required'].includes(input.status) && !input.receivedDate) errors.push(`${input.status} status requires Received Date.`);
    if (input.status === 'Rejected' && !input.rejectionReason.trim()) errors.push('Rejected items require a rejection reason.');
    if (input.status === 'Waived' && !input.waiverReason.trim()) errors.push('Waived items require a reason.');
    if (input.assignedClientContactId) {
      const contact = await this.contacts.getById(input.assignedClientContactId);
      if (!contact || contact.isDeleted || !contact.isActive || contact.clientId !== engagement.clientId) errors.push('Assigned Client Contact must be an active contact of the engagement client.');
    }
    if (input.linkedWorkingPaperId) {
      const wp = await this.workingPapers.getById(input.linkedWorkingPaperId);
      if (!wp || wp.isDeleted || wp.engagementId !== request.engagementId) errors.push('Linked Working Paper is invalid for this engagement.');
    }
    const all = await this.items.list({ includeDeleted: true });
    if (all.some(item => item.id !== id && !item.isDeleted && item.requestId === input.requestId && item.itemCode.trim().toLowerCase() === input.itemCode.trim().toLowerCase())) errors.push('Item Code must be unique within the request.');
    if (errors.length) throw new ValidationError('Document request item could not be saved.', errors);
    const normalized = { ...input, itemCode: input.itemCode.trim(), description: input.description.trim(), fileName: input.fileName.trim(), localPhysicalFileReference: input.localPhysicalFileReference.trim(), reviewResult: input.reviewResult.trim(), rejectionReason: input.rejectionReason.trim(), waiverReason: input.waiverReason.trim(), notes: input.notes.trim() };
    if (existing) {
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.items.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Document Request Item', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName, reason: saved.status === 'Rejected' ? saved.rejectionReason : saved.status === 'Waived' ? saved.waiverReason : '' });
      return saved;
    }
    const saved = await this.items.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Document Request Item', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: `Request item ${saved.itemCode} created`, operatorName });
    return saved;
  }

  async addReminder(input: DocumentRequestReminderInput, operatorName: string): Promise<DocumentRequestReminder> {
    const request = await this.requests.getById(input.requestId);
    if (!request || request.isDeleted) throw new ValidationError('Reminder could not be recorded.', ['Parent Document Request was not found.']);
    await requireMutableAuditEngagement(this.engagements, this.activity, request.engagementId, operatorName, 'document request reminder');
    const errors: string[] = [];
    if (!input.reminderDate) errors.push('Reminder Date is required.');
    if (!input.note.trim()) errors.push('Reminder Note is required.');
    if (input.requestItemId) {
      const item = await this.items.getById(input.requestItemId);
      if (!item || item.isDeleted || item.requestId !== request.id) errors.push('Request Item is invalid for this request.');
    }
    if (errors.length) throw new ValidationError('Reminder could not be recorded.', errors);
    const saved = await this.reminders.create({ ...createMetadata(input.status, operatorName), ...input, recipient: input.recipient.trim(), note: input.note.trim() });
    await this.activity.log({ entityType: 'Document Request', entityId: request.id, action: 'Update', previousStatus: request.status, newStatus: request.status, changedFieldSummary: `Reminder recorded for ${input.reminderDate}`, operatorName });
    return saved;
  }

  isRequestOverdue(request: DocumentRequest): boolean { return isPastDue(request.overallDueDate, ['Accepted', 'Waived', 'Closed'].includes(request.status)); }
  isItemOverdue(item: DocumentRequestItem): boolean { return isPastDue(item.dueDate, ['Accepted', 'Waived', 'Closed'].includes(item.status)); }
  async forEngagement(engagementId: string): Promise<DocumentRequest[]> { return (await this.requests.list()).filter(item => item.engagementId === engagementId); }
  async itemsForRequest(requestId: string): Promise<DocumentRequestItem[]> { return (await this.items.list()).filter(item => item.requestId === requestId); }
  async remindersForRequest(requestId: string): Promise<DocumentRequestReminder[]> { return (await this.reminders.list()).filter(item => item.requestId === requestId); }
  async getRequest(id: string): Promise<DocumentRequest | null> { return this.requests.getById(id); }
  async getItem(id: string): Promise<DocumentRequestItem | null> { return this.items.getById(id); }
  async listRequests(includeDeleted = false): Promise<DocumentRequest[]> { return this.requests.list({ includeDeleted }); }
  async listItems(includeDeleted = false): Promise<DocumentRequestItem[]> { return this.items.list({ includeDeleted }); }
  async listReminders(includeDeleted = false): Promise<DocumentRequestReminder[]> { return this.reminders.list({ includeDeleted }); }
}
