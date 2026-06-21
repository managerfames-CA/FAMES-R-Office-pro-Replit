import { spawn } from 'node:child_process';
import { join } from 'node:path';

const vitest = join(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');
const componentSuites = [
  ['src/tests/component.test.tsx', 30],
  ['src/tests/phase3-component.test.tsx', 17],
  ['src/tests/phase4-component.test.tsx', 12],
  ['src/tests/phase5-component.test.tsx', 10],
  ['src/tests/phase6-component.test.tsx', 9],
];
const serviceSuites = [
  ['src/tests/architecture.test.ts', 11],
  ['src/tests/domain.test.ts', 49],
  ['src/tests/correction.test.ts', 28],
  ['src/tests/phase2a.test.ts', 35],
  ['src/tests/phase2.test.ts', 36],
  ['src/tests/phase3.test.ts', 35],
  ['src/tests/phase4.test.ts', 41],
  ['src/tests/phase5.test.ts', 36],
  ['src/tests/phase6.test.ts', 26],
  ['src/tests/phase7.test.ts', 4],
];

function run(label, files, workers) {
  return new Promise((resolve, reject) => {
    console.log(`\n===== ${label} =====`);
    const child = spawn(process.execPath, [
      vitest,
      'run',
      ...files,
      '--pool=forks',
      `--maxWorkers=${workers}`,
      '--fileParallelism=false',
      '--reporter=dot',
    ], { stdio: 'inherit', shell: false, env: process.env });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${label} failed with exit code ${code ?? 1}`)));
  });
}

try {
  await Promise.all([
    run('React component interaction and route checks', componentSuites.map(([file]) => file), 3),
    run('Unit, service integration, and static architecture checks', serviceSuites.map(([file]) => file), 6),
  ]);
  const suites = [...componentSuites, ...serviceSuites];
  const total = suites.reduce((sum, [, count]) => sum + count, 0);
  console.log(`\nAll ${total} tests passed across ${suites.length} classified test files.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
