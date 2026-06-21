import type { IStorageGateway } from '../interfaces/IStorageGateway';
import { RepositoryError } from '../../utils/errors';

export class BrowserStorageGateway implements IStorageGateway {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      throw new RepositoryError(`Unable to read local data for ${key}. ${error instanceof Error ? error.message : ''}`, 'STORAGE_READ_FAILED');
    }
  }

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'QuotaExceededError'
        ? 'Local storage is full. Export a backup and archive old data before trying again.'
        : `Unable to save local data for ${key}.`;
      throw new RepositoryError(message, 'STORAGE_WRITE_FAILED');
    }
  }

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      throw new RepositoryError(`Unable to remove local data for ${key}.`, 'STORAGE_REMOVE_FAILED');
    }
  }
}
