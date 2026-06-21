import { DEFAULT_SETTINGS } from '../constants/statuses';
import type { AppSettings } from '../types/models';
import type { IStorageGateway } from '../repositories/interfaces/IStorageGateway';
import { STORAGE_KEYS } from '../repositories/localStorage/keys';
import { RepositoryError, ValidationError } from '../utils/errors';

export class SettingsService {
  constructor(private readonly storage: IStorageGateway) {}

  get(): AppSettings {
    const raw = this.storage.getItem(STORAGE_KEYS.settings);
    if (!raw) {
      this.storage.setItem(STORAGE_KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
      return structuredClone(DEFAULT_SETTINGS);
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      const merged = {
        ...structuredClone(DEFAULT_SETTINGS),
        ...parsed,
        numbering: { ...DEFAULT_SETTINGS.numbering, ...(parsed.numbering ?? {}), referencePrefixes: { ...DEFAULT_SETTINGS.numbering.referencePrefixes, ...(parsed.numbering?.referencePrefixes ?? {}) } },
        statusSettings: Array.isArray(parsed.statusSettings) ? parsed.statusSettings : DEFAULT_SETTINGS.statusSettings
      };
      return { ...merged, schemaVersion: DEFAULT_SETTINGS.schemaVersion, appVersion: DEFAULT_SETTINGS.appVersion };
    } catch {
      throw new RepositoryError('App settings are corrupt. Restore a valid backup or reset settings.', 'CORRUPT_SETTINGS');
    }
  }

  save(settings: AppSettings): AppSettings {
    const errors: string[] = [];
    if (!settings.operatorName.trim()) errors.push('Operator name is required.');
    if (!Number.isInteger(settings.upcomingDeadlineDays) || settings.upcomingDeadlineDays < 1 || settings.upcomingDeadlineDays > 365) errors.push('Upcoming deadline days must be between 1 and 365.');
    if (!Number.isFinite(settings.expenseReceiptThreshold) || settings.expenseReceiptThreshold < 0) errors.push('Expense receipt threshold must be zero or greater.');
    if (settings.numbering.startingSequence < 1) errors.push('Starting sequence must be positive.');
    if (settings.numbering.numberPadding < 1 || settings.numbering.numberPadding > 10) errors.push('Number padding must be between 1 and 10.');
    for (const [name, prefix] of Object.entries(settings.numbering.referencePrefixes)) {
      if (!prefix.trim()) errors.push(`${name} reference prefix is required.`);
      if (prefix.length > 16) errors.push(`${name} reference prefix cannot exceed 16 characters.`);
    }
    if (errors.length) throw new ValidationError('Settings could not be saved.', errors);
    const versioned = { ...settings, schemaVersion: DEFAULT_SETTINGS.schemaVersion, appVersion: DEFAULT_SETTINGS.appVersion };
    this.storage.setItem(STORAGE_KEYS.settings, JSON.stringify(versioned));
    return structuredClone(versioned);
  }

  generateNextCode(kind: 'client' | 'engagement', existingCodes: string[]): string {
    const settings = this.get();
    const prefix = kind === 'client' ? settings.numbering.clientPrefix : settings.numbering.engagementPrefix;
    let sequence = settings.numbering.startingSequence;
    const used = new Set(existingCodes.map(code => code.toUpperCase()));
    while (used.has(`${prefix}${String(sequence).padStart(settings.numbering.numberPadding, '0')}`.toUpperCase())) sequence += 1;
    return `${prefix}${String(sequence).padStart(settings.numbering.numberPadding, '0')}`;
  }

  reset(): AppSettings {
    this.storage.setItem(STORAGE_KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
    return structuredClone(DEFAULT_SETTINGS);
  }
}
