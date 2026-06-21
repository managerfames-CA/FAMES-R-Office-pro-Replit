import type { IRepository } from '../repositories/interfaces/IRepository';
import type { MasterRecord } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { normalizeCode } from '../utils/normalize';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';

export type MasterInput = Omit<MasterRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class MasterDataService {
  constructor(private readonly entityType: string, private readonly repository: IRepository<MasterRecord>, private readonly activity: ActivityService, private readonly isReferenced: (id: string) => Promise<boolean>) {}

  async save(input: MasterInput, operatorName: string, id?: string): Promise<MasterRecord> {
    const normalized = { ...input, code: normalizeCode(input.code), name: input.name.trim().replace(/\s+/g, ' ') };
    const errors: string[] = [];
    if (!normalized.code) errors.push('Code is required.');
    if (!normalized.name) errors.push('Name is required.');
    const all = await this.repository.list({ includeDeleted: true });
    if (all.some(item => item.id !== id && normalizeCode(item.code) === normalized.code)) errors.push('Code already exists.');
    if (all.some(item => item.id !== id && item.name.toLocaleLowerCase() === normalized.name.toLocaleLowerCase())) errors.push('Name already exists.');
    if (errors.length) throw new ValidationError(`${this.entityType} could not be saved.`, errors);
    if (id) {
      const existing = await this.repository.getById(id);
      if (!existing) throw new AppError(`${this.entityType} was not found.`, 'NOT_FOUND');
      const saved = await this.repository.update(updateMetadata({ ...existing, ...normalized }, operatorName));
      await this.activity.log({ entityType: this.entityType, entityId: saved.id, action: 'Update', changedFieldSummary: `${this.entityType} updated`, operatorName });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: this.entityType, entityId: saved.id, action: 'Create', changedFieldSummary: `${this.entityType} created`, operatorName });
    return saved;
  }

  async archive(id: string, operatorName: string): Promise<MasterRecord> {
    if (await this.isReferenced(id)) throw new ValidationError(`${this.entityType} cannot be archived.`, ['This master record is referenced by operational data. Mark it inactive instead.']);
    const saved = await this.repository.archive(id, operatorName);
    await this.activity.log({ entityType: this.entityType, entityId: id, action: 'Archive', changedFieldSummary: `${this.entityType} archived`, operatorName });
    return saved;
  }

  async list(includeDeleted = false): Promise<MasterRecord[]> { return this.repository.list({ includeDeleted }); }
}
