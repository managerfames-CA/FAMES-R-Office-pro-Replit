// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('Architecture and UI acceptance checks', () => {
  it('50 pages do not directly access localStorage', () => {
    const pages = [...filesUnder(join(root, 'src/pages')), ...filesUnder(join(root, 'src/features'))];
    for (const file of pages) expect(readFileSync(file, 'utf8')).not.toMatch(/\blocalStorage\s*\./);
  });
  it('51 components do not directly access localStorage', () => {
    const files = [...filesUnder(join(root, 'src/components')), ...filesUnder(join(root, 'src/layouts'))];
    for (const file of files) expect(readFileSync(file, 'utf8')).not.toMatch(/\blocalStorage\s*\./);
  });
  it('52 responsive CSS contains tablet and mobile breakpoints', () => {
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
    expect(css).toContain('@media(max-width:820px)'); expect(css).toContain('@media(max-width:520px)');
  });
  it('53 responsive CSS prevents mobile table overflow with card layout', () => {
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
    expect(css).toMatch(/\.table-wrap table.*display:block/s); expect(css).toContain('overflow:auto');
  });
  it('54 all main navigation routes exist', () => {
    const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
    for (const route of ['clients','engagements','tasks','deadlines','staff','administration/services','administration/backup','administration/activity']) expect(app).toContain(`path="${route}"`);
  });
  it('55 complete Phase 2 and Phase 3 routes are present', () => {
    const planning = readFileSync(join(root, 'src/features/auditPlanning/AuditPlanningPage.tsx'), 'utf8');
    for (const route of ['risks','materiality','programme','working-papers','evidence','sampling','document-requests']) expect(planning).toContain(route);
    for (const route of ['review-notes','manager-review','partner-review','completion-checklist','findings','audit-reports','management-letter','representation-letter','report-issue','file-lock','amendments']) expect(planning).toContain(route);
  });
  it('56 separate namespaced storage keys are defined', () => {
    const keys = readFileSync(join(root, 'src/repositories/localStorage/keys.ts'), 'utf8');
    for (const key of ['afm:clients','afm:client_contacts','afm:staff','afm:engagements','afm:tasks','afm:audit_events','afm:audit_risks','afm:audit_materiality','afm:programme_templates','afm:engagement_programmes','afm:working_papers','afm:evidence_register','afm:sampling_register','afm:document_requests','afm:document_request_items','afm:document_request_reminders','afm:review_notes','afm:audit_completion_items','afm:audit_findings','afm:report_versions','afm:management_letters','afm:representation_letters','afm:report_issues','afm:engagement_locks','afm:amendment_requests','afm:manager_review_records','afm:partner_review_records']) expect(keys).toContain(key);
  });
  it('57 repository interface supports adapter replacement', () => {
    const repository = readFileSync(join(root, 'src/repositories/interfaces/IRepository.ts'), 'utf8');
    expect(repository).toContain('export interface IRepository'); expect(repository).toContain('replaceAll');
  });
  it('58 error boundary is installed', () => {
    const app = readFileSync(join(root, 'src/App.tsx'), 'utf8'); expect(app).toContain('<ErrorBoundary>');
  });
  it('59 package scripts include local run build typecheck and tests', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string,string> };
    expect(pkg.scripts.dev).toBe('vite'); expect(pkg.scripts.build).toContain('vite build'); expect(pkg.scripts.typecheck).toContain('tsc'); expect(pkg.scripts['test:run']).toContain('run-tests.mjs'); const runner=readFileSync(join(root,'scripts/run-tests.mjs'),'utf8'); expect(runner).toContain('vitest'); expect(runner).toContain('component.test.tsx'); expect(runner).toContain('phase3-component.test.tsx'); expect(runner).toContain('architecture.test.ts');
  });
  it('77 package versions are pinned exactly', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { dependencies: Record<string,string>; devDependencies: Record<string,string> };
    for (const version of [...Object.values(pkg.dependencies), ...Object.values(pkg.devDependencies)]) {
      expect(version).not.toMatch(/latest|[~^*xX]/);
      expect(version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    }
  });
});
