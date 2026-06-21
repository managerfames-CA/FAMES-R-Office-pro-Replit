import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHarness, seedActiveClient } from './harness';
import { checksum } from '../utils/checksum';

describe('Phase 7 final acceptance hardening', () => {
  it('376 rejects prohibited prototype keys in a backup payload', async () => {
    const h = createHarness();
    await seedActiveClient(h);
    const backup = h.services.backup.createBackup();
    const firstKey = Object.keys(backup.data)[0];
    backup.data[firstKey] = [JSON.parse('{"id":"unsafe","__proto__":{"polluted":true}}')];
    const preview = h.services.backup.preview(backup, 'replace');
    expect(preview.valid).toBe(false);
    expect(preview.errors.some(error => error.includes('prohibited object key'))).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('377 keeps valid generated backup checksum verification intact', async () => {
    const h = createHarness();
    await seedActiveClient(h);
    const backup = h.services.backup.createBackup();
    const preview = h.services.backup.preview(backup, 'replace');
    expect(preview.valid).toBe(true);
    expect(preview.checksumMatches).toBe(true);
    expect(checksum).toBeTypeOf('function');
  });

  it('378 production error boundary does not render raw exception messages', () => {
    const source = readFileSync('src/components/ErrorBoundary.tsx', 'utf8');
    expect(source).not.toContain('{this.state.message}');
    expect(source).toContain('if (import.meta.env.DEV)');
    expect(source).toContain('No data was changed.');
  });

  it('379 controlled amendment explicitly blocks dangerous object keys', () => {
    const source = readFileSync('src/services/AmendmentService.ts', 'utf8');
    expect(source).toContain("['__proto__','prototype','constructor']");
    expect(source).toContain('Proposed Change contains a prohibited object key.');
  });
});
