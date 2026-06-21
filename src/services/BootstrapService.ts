import { DEFAULT_SETTINGS, SERVICE_TYPES } from '../constants/statuses';
import { repositories, gateway } from '../repositories';
import { STORAGE_KEYS } from '../repositories/localStorage/keys';
import { createMetadata } from './helpers';
import { services } from './index';

export async function bootstrapApplication(): Promise<void> {
  const settings = services.settings.get();
  const storedSettings = gateway.getItem(STORAGE_KEYS.settings);
  if (storedSettings) gateway.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  const metaRaw = gateway.getItem(STORAGE_KEYS.meta);
  if (!metaRaw) {
    gateway.setItem(STORAGE_KEYS.meta, JSON.stringify({ schemaVersion: settings.schemaVersion, appVersion: settings.appVersion, initializedAt: new Date().toISOString(), lastBackupAt: '' }));
  } else {
    try {
      const meta = JSON.parse(metaRaw) as Record<string, unknown>;
      gateway.setItem(STORAGE_KEYS.meta, JSON.stringify({ ...meta, schemaVersion: DEFAULT_SETTINGS.schemaVersion, appVersion: DEFAULT_SETTINGS.appVersion }));
    } catch { /* startup recovery will report corrupt meta through backup validation when used */ }
  }
  const existing = await repositories.services.list({ includeDeleted: true });
  if (existing.length === 0) {
    for (const name of SERVICE_TYPES) await repositories.services.create({ ...createMetadata('Active', 'System Setup'), code: name.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), name, description: 'Approved service type', isActive: true });
  }
}
