import type { BaseRecord } from '../../types/models';
import type { IRepository } from '../interfaces/IRepository';
import type { IStorageGateway } from '../interfaces/IStorageGateway';
import { RepositoryError } from '../../utils/errors';
import { nowIso } from '../../utils/dates';

export class LocalStorageRepository<T extends BaseRecord> implements IRepository<T> {
  constructor(private readonly key: string, private readonly storage: IStorageGateway) {}

  private readAll(): T[] {
    const raw = this.storage.getItem(this.key);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Expected an array');
      return parsed as T[];
    } catch (error) {
      throw new RepositoryError(`Stored data for ${this.key} is corrupt or unsupported. Export unaffected modules before resetting this module. ${error instanceof Error ? error.message : ''}`, 'CORRUPT_DATA');
    }
  }

  private writeAll(records: T[]): void {
    this.storage.setItem(this.key, JSON.stringify(records));
  }

  async list(options?: { includeDeleted?: boolean }): Promise<T[]> {
    const records = this.readAll();
    return options?.includeDeleted ? structuredClone(records) : structuredClone(records.filter(record => !record.isDeleted));
  }

  async getById(id: string): Promise<T | null> {
    const record = this.readAll().find(item => item.id === id);
    return record ? structuredClone(record) : null;
  }

  async create(record: T): Promise<T> {
    const records = this.readAll();
    if (records.some(item => item.id === record.id)) throw new RepositoryError(`Record ${record.id} already exists.`, 'DUPLICATE_ID');
    records.push(structuredClone(record));
    this.writeAll(records);
    return structuredClone(record);
  }

  async update(record: T): Promise<T> {
    const records = this.readAll();
    const index = records.findIndex(item => item.id === record.id);
    if (index < 0) throw new RepositoryError(`Record ${record.id} was not found.`, 'NOT_FOUND');
    const existing = records[index];
    if (record.recordVersion < existing.recordVersion) throw new RepositoryError('This record was changed in another tab. Reload before saving.', 'VERSION_CONFLICT');
    records[index] = structuredClone(record);
    this.writeAll(records);
    return structuredClone(record);
  }

  async archive(id: string, operatorName: string): Promise<T> {
    const record = await this.getById(id);
    if (!record) throw new RepositoryError('Record not found.', 'NOT_FOUND');
    return this.update({ ...record, isDeleted: true, updatedAt: nowIso(), updatedByName: operatorName, recordVersion: record.recordVersion + 1 });
  }

  async restore(id: string, operatorName: string): Promise<T> {
    const record = await this.getById(id);
    if (!record) throw new RepositoryError('Record not found.', 'NOT_FOUND');
    return this.update({ ...record, isDeleted: false, updatedAt: nowIso(), updatedByName: operatorName, recordVersion: record.recordVersion + 1 });
  }

  async replaceAll(records: T[]): Promise<void> {
    this.writeAll(structuredClone(records));
  }

  async clear(): Promise<void> {
    this.storage.removeItem(this.key);
  }
}
