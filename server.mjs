import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(projectRoot, 'dist');
const indexFile = resolve(publicRoot, 'index.html');
const host = (process.env.HOST || '0.0.0.0').trim();
const portText = (process.env.PORT || '3000').trim();
const port = Number(portText);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`PORT must be an integer from 1 to 65535. Received: ${JSON.stringify(portText)}`);
}

if (!existsSync(indexFile)) {
  throw new Error('Production build not found. Run "npm run build" before "npm run start".');
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function applySecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function sendJson(response, statusCode, body, method = 'GET') {
  const payload = Buffer.from(JSON.stringify(body));
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', String(payload.byteLength));
  response.setHeader('Cache-Control', 'no-store');
  applySecurityHeaders(response);
  response.end(method === 'HEAD' ? undefined : payload);
}

function safeResolve(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const relativePath = decoded.replace(/^\/+/, '');
  const candidate = resolve(publicRoot, relativePath);
  if (candidate !== publicRoot && !candidate.startsWith(`${publicRoot}${sep}`)) return null;
  return candidate;
}

async function serveFile(response, method, filePath, cacheControl) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) return false;

  response.statusCode = 200;
  response.setHeader('Content-Type', contentTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream');
  response.setHeader('Content-Length', String(fileStat.size));
  response.setHeader('Cache-Control', cacheControl);
  applySecurityHeaders(response);

  if (method === 'HEAD') {
    response.end();
    return true;
  }

  await new Promise((resolveStream, rejectStream) => {
    const stream = createReadStream(filePath);
    stream.once('error', rejectStream);
    stream.once('end', resolveStream);
    stream.pipe(response);
  });
  return true;
}

const server = createServer(async (request, response) => {
  const method = request.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    sendJson(response, 405, { status: 'error', error: 'Method not allowed' }, method);
    return;
  }

  let url;
  try {
    url = new URL(request.url || '/', 'http://localhost');
  } catch {
    sendJson(response, 400, { status: 'error', error: 'Invalid request URL' }, method);
    return;
  }

  if (url.pathname === '/health' || url.pathname === '/api/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'FAMES & R Office Work',
      version: '7.1.0-replit',
      persistence: 'browser-localStorage',
      databaseConfigured: false,
      authenticationConfigured: false,
    }, method);
    return;
  }

  const requestedFile = safeResolve(url.pathname);
  if (!requestedFile) {
    sendJson(response, 400, { status: 'error', error: 'Invalid path' }, method);
    return;
  }

  try {
    if (url.pathname !== '/') {
      const cacheControl = url.pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';
      if (await serveFile(response, method, requestedFile, cacheControl)) return;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') {
      console.error('Static file error:', error);
      if (!response.headersSent) sendJson(response, 500, { status: 'error', error: 'Internal server error' }, method);
      else response.destroy();
      return;
    }
  }

  // The approved application uses HashRouter, but an HTML fallback keeps direct links resilient.
  if (url.pathname === '/' || extname(url.pathname) === '') {
    try {
      await serveFile(response, method, indexFile, 'no-cache');
      return;
    } catch (error) {
      console.error('Index file error:', error);
      if (!response.headersSent) sendJson(response, 500, { status: 'error', error: 'Application entry file unavailable' }, method);
      else response.destroy();
      return;
    }
  }

  sendJson(response, 404, { status: 'error', error: 'Not found' }, method);
});

server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

server.listen(port, host, () => {
  console.log(`FAMES & R Office Work listening on http://${host}:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received; closing server.`);
  server.close((error) => {
    if (error) {
      console.error('Server shutdown error:', error);
      process.exitCode = 1;
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
