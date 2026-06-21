import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Staff } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { isValidEmail, normalizeCode, normalizeEmail } from '../utils/normalize';
import { createMetadata, updateMetadata } from './helpers';
import type { ActivityService } from './ActivityService';

export type StaffInput = Omit<Staff, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName' | 'recordVersion' | 'isDeleted'>;

export class StaffService {
  constructor(private readonly repository: IRepository<Staff>, private readonly activity: ActivityService) {}

  async save(input: StaffInput, operatorName: string, id?: string): Promise<Staff> {
    const normalized = { ...input, staffCode: normalizeCode(input.staffCode), fullName: input.fullName.trim().replace(/\s+/g, ' '), email: normalizeEmail(input.email) };
    const errors: string[] = [];
    if (!normalized.staffCode) errors.push('Staff code is required.');
    if (!normalized.fullName) errors.push('Full name is required.');
    if (!isValidEmail(normalized.email)) errors.push('Email format is invalid.');
    if (!Number.isFinite(normalized.weeklyCapacityHours) || normalized.weeklyCapacityHours < 0 || normalized.weeklyCapacityHours > 168) errors.push('Weekly capacity hours must be between 0 and 168.');
    const all = await this.repository.list({ includeDeleted: true });
    if (all.some(staff => staff.id !== id && normalizeCode(staff.staffCode) === normalized.staffCode)) errors.push('Staff code already exists.');
    if (errors.length) throw new ValidationError('Staff record could not be saved.', errors);
    if (id) {
      const existing = await this.repository.getById(id);
      if (!existing) throw new AppError('Staff record was not found.', 'NOT_FOUND');
      const saved = await this.repository.update(updateMetadata({ ...existing, ...normalized }, operatorName));
      await this.activity.log({ entityType: 'Staff', entityId: saved.id, action: existing.status === saved.status ? 'Update' : 'Status Change', previousStatus: existing.status, newStatus: saved.status, changedFieldSummary: 'Staff updated', operatorName });
      return saved;
    }
    const saved = await this.repository.create({ ...createMetadata(normalized.status, operatorName), ...normalized });
    await this.activity.log({ entityType: 'Staff', entityId: saved.id, action: 'Create', newStatus: saved.status, changedFieldSummary: 'Staff created', operatorName });
    return saved;
  }

  async list(includeDeleted = false): Promise<Staff[]> { return this.repository.list({ includeDeleted }); }
  async get(id: string): Promise<Staff | null> { return this.repository.getById(id); }
}
