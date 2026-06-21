import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Client, ClientContact } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { isValidEmail, normalizeEmail } from '../utils/normalize';
import { createMetadata, updateMetadata } from './helpers';
import { summarizeChanges } from '../utils/changeSummary';
import type { ActivityService } from './ActivityService';

export type ClientContactInput = Omit<ClientContact, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class ClientContactService {
  constructor(private readonly repository: IRepository<ClientContact>, private readonly clients: IRepository<Client>, private readonly activity: ActivityService) {}

  async save(input: ClientContactInput, operatorName: string, id?: string): Promise<ClientContact> {
    const errors: string[] = [];
    const client = await this.clients.getById(input.clientId);
    if (!client) errors.push('Selected client was not found.');
    else if (client.isDeleted || client.status === 'Inactive' || client.status === 'Rejected') errors.push('New or active contacts cannot be assigned to an archived, inactive or rejected client.');
    if (!input.name.trim()) errors.push('Contact name is required.');
    if (!isValidEmail(input.email)) errors.push('Email format is invalid.');
    if (errors.length) throw new ValidationError('Contact could not be saved.', errors);
    const all = await this.repository.list({ includeDeleted: true });
    const normalized = { ...input, name: input.name.trim(), email: normalizeEmail(input.email) };
    if (normalized.isPrimary) {
      for (const contact of all.filter(item => item.clientId === normalized.clientId && item.isPrimary && item.id !== id && !item.isDeleted)) {
        const demoted = await this.repository.update(updateMetadata({ ...contact, isPrimary: false }, operatorName));
        await this.activity.log({ entityType: 'Client Contact', entityId: demoted.id, action: 'Update', changedFieldSummary: `Primary Contact: Yes → No; reassigned to ${normalized.name}`, operatorName });
      }
    }
    if (id) {
      const existing = await this.repository.getById(id);
      if (!existing) throw new AppError('Contact was not found.', 'NOT_FOUND');
      const candidate = { ...existing, ...normalized };
      const summary = summarizeChanges(existing, candidate);
      if (!summary) return existing;
      const saved = await this.repository.update(updateMetadata(candidate, operatorName));
      await this.activity.log({ entityType: 'Client Contact', entityId: saved.id, action: 'Update', changedFieldSummary: summary, operatorName });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Client Contact', entityId: saved.id, action: 'Create', changedFieldSummary: normalized.isPrimary ? 'Contact created and set as primary contact' : 'Contact created', operatorName });
    return saved;
  }

  async list(includeDeleted = false): Promise<ClientContact[]> {
    return this.repository.list({ includeDeleted });
  }

  async forClient(clientId: string, includeDeleted = false): Promise<ClientContact[]> {
    return (await this.repository.list({ includeDeleted })).filter(contact => contact.clientId === clientId);
  }

  async archive(id: string, operatorName: string): Promise<ClientContact> {
    const saved = await this.repository.archive(id, operatorName);
    await this.activity.log({ entityType: 'Client Contact', entityId: id, action: 'Archive', changedFieldSummary: 'Contact archived', operatorName });
    return saved;
  }
}
