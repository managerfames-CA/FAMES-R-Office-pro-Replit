import type { BaseRecord } from '../types/models';
import { createId } from '../utils/id';
import { nowIso } from '../utils/dates';

export function createMetadata<T extends string>(status: T, operatorName: string): Pick<BaseRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'status' | 'isDeleted'> {
  const now = nowIso();
  return {
    id: createId(),
    createdAt: now,
    updatedAt: now,
    createdByName: operatorName,
    updatedByName: operatorName,
    recordVersion: 1,
    status,
    isDeleted: false
  };
}

export function updateMetadata<T extends BaseRecord>(record: T, operatorName: string): T {
  return {
    ...record,
    updatedAt: nowIso(),
    updatedByName: operatorName,
    recordVersion: record.recordVersion + 1
  };
}
