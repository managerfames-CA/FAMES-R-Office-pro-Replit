import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = 43127;
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, HOST: '0.0.0.0', PORT: String(port), NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
child.stdout.on('data', chunk => { stdout += chunk.toString(); process.stdout.write(chunk); });
child.stderr.on('data', chunk => { stderr += chunk.toString(); process.stderr.write(chunk); });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited before verification.\n${stderr || stdout}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The process can need a brief moment to open its socket.
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  throw new Error('Server did not become healthy within five seconds.');
}

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.text();
  return { response, body };
}

try {
  await readFile(resolve('dist/index.html'), 'utf8');
  await waitForServer();

  const health = await request('/health');
  assert(health.response.status === 200, '/health did not return HTTP 200.');
  const healthBody = JSON.parse(health.body);
  assert(healthBody.status === 'ok', '/health status was not ok.');
  assert(healthBody.persistence === 'browser-localStorage', '/health persistence disclosure is incorrect.');

  const apiHealth = await request('/api/health');
  assert(apiHealth.response.status === 200, '/api/health did not return HTTP 200.');

  const root = await request('/');
  assert(root.response.status === 200 && root.body.includes('<div id="root">'), 'Root application page did not load.');
  const scriptMatch = root.body.match(/<script[^>]+src="([^"]+\.js)"/);
  assert(scriptMatch, 'Built JavaScript asset was not referenced by index.html.');
  const assetPath = new URL(scriptMatch[1], `${baseUrl}/`).pathname;
  const asset = await request(assetPath);
  assert(asset.response.status === 200, 'Built JavaScript asset did not load.');
  assert((asset.response.headers.get('content-type') || '').includes('javascript'), 'JavaScript asset MIME type is incorrect.');

  const fallback = await request('/clients');
  assert(fallback.response.status === 200 && fallback.body.includes('<div id="root">'), 'HTML route fallback failed.');

  const missingAsset = await request('/assets/definitely-missing.js');
  assert(missingAsset.response.status === 404, 'Missing asset did not return HTTP 404.');

  const invalidMethod = await request('/health', { method: 'POST' });
  assert(invalidMethod.response.status === 405, 'Unsupported method did not return HTTP 405.');

  const head = await request('/', { method: 'HEAD' });
  assert(head.response.status === 200 && head.body === '', 'HEAD request behavior is incorrect.');

  console.log('\nProduction verification PASS: health, API health, root HTML, built asset, route fallback, 404, 405, HEAD, and 0.0.0.0 binding.');
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolveExit => child.once('exit', resolveExit)),
    new Promise(resolveTimeout => setTimeout(resolveTimeout, 3_000)),
  ]);
}
