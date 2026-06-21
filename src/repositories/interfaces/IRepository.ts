import type { BaseRecord } from '../../types/models';

export interface IRepository<T extends BaseRecord> {
  list(options?: { includeDeleted?: boolean }): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(record: T): Promise<T>;
  update(record: T): Promise<T>;
  archive(id: string, operatorName: string): Promise<T>;
  restore(id: string, operatorName: string): Promise<T>;
  replaceAll(records: T[]): Promise<void>;
  clear(): Promise<void>;
}
