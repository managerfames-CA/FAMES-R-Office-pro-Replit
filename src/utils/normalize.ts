export const normalizeIdentifier = (value: string): string => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
export const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export const normalizeCode = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, '');
export const normalizeEmail = (value: string): string => value.trim().toLocaleLowerCase();
export const isValidEmail = (value: string): boolean => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
