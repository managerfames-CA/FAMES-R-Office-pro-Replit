import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Client, ClientStatus } from '../types/models';
import { ValidationError, AppError } from '../utils/errors';
import { isValidEmail, normalizeCode, normalizeEmail, normalizeIdentifier, normalizeName } from '../utils/normalize';
import { createMetadata, updateMetadata } from './helpers';
import { summarizeChanges } from '../utils/changeSummary';
import type { ActivityService } from './ActivityService';

export type ClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class ClientService {
  constructor(
    private readonly repository: IRepository<Client>,
    private readonly activity: ActivityService
  ) {}

  private normalize(input: ClientInput): ClientInput {
    return {
      ...input,
      clientCode: normalizeCode(input.clientCode),
      legalName: input.legalName.trim().replace(/\s+/g, ' '),
      tradeName: input.tradeName.trim().replace(/\s+/g, ' '),
      tin: normalizeIdentifier(input.tin),
      bin: normalizeIdentifier(input.bin),
      registrationNumber: normalizeIdentifier(input.registrationNumber),
      primaryEmail: normalizeEmail(input.primaryEmail),
      website: input.website.trim(),
      duplicateOverrideReason: input.duplicateOverrideReason?.trim()
    };
  }

  private async validate(input: ClientInput, currentId?: string): Promise<string[]> {
    const errors: string[] = [];
    if (!input.clientCode) errors.push('Client code is required.');
    if (!input.legalName.trim()) errors.push('Legal name is required.');
    if (!isValidEmail(input.primaryEmail)) errors.push('Primary email format is invalid.');
    const existing = await this.repository.list({ includeDeleted: true });
    if (existing.some(client => client.id !== currentId && normalizeCode(client.clientCode) === input.clientCode)) errors.push('Client code already exists.');
    const duplicates: string[] = [];
    if (existing.some(client => client.id !== currentId && !client.isDeleted && normalizeName(client.legalName) === normalizeName(input.legalName))) duplicates.push('legal name');
    if (input.tin && existing.some(client => client.id !== currentId && !client.isDeleted && normalizeIdentifier(client.tin) === input.tin)) duplicates.push('TIN');
    if (input.bin && existing.some(client => client.id !== currentId && !client.isDeleted && normalizeIdentifier(client.bin) === input.bin)) duplicates.push('BIN');
    if (input.registrationNumber && existing.some(client => client.id !== currentId && !client.isDeleted && normalizeIdentifier(client.registrationNumber) === input.registrationNumber)) duplicates.push('registration number');
    if (duplicates.length && !input.duplicateOverrideReason) errors.push(`Possible duplicate detected by ${duplicates.join(', ')}. Enter an override reason to continue.`);
    return errors;
  }

  async create(input: ClientInput, operatorName: string): Promise<Client> {
    const normalized = this.normalize(input);
    const errors = await this.validate(normalized);
    if (errors.length) throw new ValidationError('Client could not be created.', errors);
    const record: Client = { ...createMetadata(normalized.status, operatorName), ...normalized };
    const saved = await this.repository.create(record);
    await this.activity.log({ entityType: 'Client', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: 'Client created', operatorName });
    if (normalized.duplicateOverrideReason) await this.activity.log({ entityType: 'Client', entityId: saved.id, action: 'Duplicate Override', newStatus: saved.status, changedFieldSummary: 'Duplicate warning overridden', operatorName, reason: normalized.duplicateOverrideReason });
    return saved;
  }

  async update(id: string, input: ClientInput, operatorName: string): Promise<Client> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new AppError('Client was not found.', 'NOT_FOUND');
    const normalized = this.normalize(input);
    const errors = await this.validate(normalized, id);
    if (errors.length) throw new ValidationError('Client could not be updated.', errors);
    const candidate = { ...existing, ...normalized };
    const summary = summarizeChanges(existing, candidate);
    if (!summary) return existing;
    const saved = await this.repository.update(updateMetadata(candidate, operatorName));
    await this.activity.log({ entityType: 'Client', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: summary, operatorName });
    if (normalized.duplicateOverrideReason) await this.activity.log({ entityType: 'Client', entityId: saved.id, action: 'Duplicate Override', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: 'Duplicate warning overridden', operatorName, reason: normalized.duplicateOverrideReason });
    return saved;
  }

  async archive(id: string, operatorName: string): Promise<Client> {
    const saved = await this.repository.archive(id, operatorName);
    await this.activity.log({ entityType: 'Client', entityId: id, action: 'Archive', previousStatus: saved.status, newStatus: saved.status, changedFieldSummary: 'Client archived', operatorName });
    return saved;
  }

  async restore(id: string, operatorName: string): Promise<Client> {
    const saved = await this.repository.restore(id, operatorName);
    await this.activity.log({ entityType: 'Client', entityId: id, action: 'Restore', newStatus: saved.status, changedFieldSummary: 'Client restored', operatorName });
    return saved;
  }

  async list(includeDeleted = false): Promise<Client[]> { return this.repository.list({ includeDeleted }); }
  async get(id: string): Promise<Client | null> { return this.repository.getById(id); }
  canReceiveEngagement(status: ClientStatus): boolean { return status === 'Active'; }
}
