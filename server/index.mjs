import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { LocalStore } from './store.mjs';
import { AccountService } from './account-service.mjs';
import { DomainError } from './domain.mjs';
import { resolveAuthMode, authStatus, AUTH_SETUP_MESSAGE } from './auth.mjs';
import { ACCOUNT_PROJECT } from './account-config.mjs';
import { hostingConfig } from './hosting-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const sameToken = (provided, expected) => typeof provided === 'string' && Buffer.byteLength(provided) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
function sendJson(response, status, payload) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(payload)); }
async function bodyJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new DomainError('CONTENT_TYPE_REQUIRED', 'Send application/json.', 415);
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size > 1024 * 1024) throw new DomainError('BODY_TOO_LARGE', 'Request exceeds the local demo size limit.', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new DomainError('INVALID_JSON', 'Request must contain valid JSON.'); }
}
export async function startServer(options = {}) {
  const production = options.production ?? process.argv.includes('--production');
  const authMode = resolveAuthMode(options.authMode ?? process.env.ASTRA_AUTH_MODE ?? 'accounts');
  const hosting = hostingConfig({ publicOrigin: options.publicOrigin ?? process.env.ASTRA_PUBLIC_ORIGIN ?? '', production, authMode });
  const dataDir = options.dataDir ?? process.env.ASTRA_DATA_DIR ?? path.join(ROOT, '.astra-data');
  const distDir = options.distDir ?? process.env.ASTRA_DIST_DIR ?? path.join(ROOT, 'dist');
  const desktopToken = options.desktopToken ?? process.env.ASTRA_DESKTOP_TOKEN;
  // An unconfigured accounts server must never open, create or expose demo data.
  // Even a caller-provided evaluation store is ignored in this mode.
  const store = authMode === 'demo' ? (options.store ?? await LocalStore.open(dataDir)) : null;
  const accounts = options.accountService ?? new AccountService(hosting.hosted ? {
    secureCookies: true,
    publicHosting: true,
    config: { ...ACCOUNT_PROJECT, activationUrl: hosting.activationUrl },
  } : {});
  if (hosting.hosted && (!accounts.enabled || !accounts.secureCookies || !accounts.publicHosting)) throw new Error('Hosted mode requires configured accounts, secure cookies and hosted abuse controls.');
  const port = options.port ?? Number(process.env.PORT ?? 4174);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535.');
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin'); response.setHeader('X-Frame-Options', 'DENY');
    let actorId = 'admin';
    try {
      const host = request.headers.host ?? '';
      if (hosting.hosted ? host !== hosting.host : !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) throw new DomainError('HOST_REJECTED', 'This hostname is not allowed.', 403);
      const url = new URL(request.url, hosting.hosted ? hosting.origin : `http://${host}`);
      if (url.pathname.startsWith('/api/')) {
        if (desktopToken && !sameToken(request.headers['x-astra-desktop-token'], desktopToken)) throw new DomainError('DESKTOP_SESSION_REQUIRED', 'The desktop session token is required.', 403);
        const origin = request.headers.origin;
        const allowedOrigins = new Set(hosting.hosted ? [hosting.origin] : [`http://${host}`, ...(!production ? ['http://127.0.0.1:4173', 'http://localhost:4173'] : [])]);
        if (origin && !allowedOrigins.has(origin)) throw new DomainError('ORIGIN_REJECTED', 'This origin is not allowed to use the local demo API.', 403);
        if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
        if (request.method === 'OPTIONS') { response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Astra-Desktop-Token, X-Astra-Csrf'); response.writeHead(204); response.end(); return; }
        if (request.method === 'GET' && url.pathname === '/api/auth/status') { sendJson(response, 200, authMode === 'accounts' && accounts.enabled ? await accounts.status(request,response) : authStatus(authMode)); return; }
        if (request.method === 'GET' && url.pathname === '/api/health') { sendJson(response, 200, { ok: true, application: 'astra-system-new', mode: authMode, synthetic: authMode === 'demo', persistence: authMode === 'demo' ? 'atomic-json-single-process' : accounts.enabled ? 'supabase-shared' : 'not_configured', accountAuthentication: authMode === 'accounts' && accounts.enabled ? 'supabase' : 'not_configured', liveIntegrations: false }); return; }
        if (authMode === 'accounts') {
          if (!accounts.enabled) throw new DomainError('AUTH_SETUP_REQUIRED', AUTH_SETUP_MESSAGE, 503, { setupRequired: true, provider: 'supabase' });
          if (request.method === 'GET' && url.pathname === '/api/state') { sendJson(response,200,await accounts.state(request,url)); return; }
          if (request.method === 'GET' && url.pathname.startsWith('/api/receipts/')) { sendJson(response,200,await accounts.receipt(request,url.pathname.split('/').at(-1))); return; }
          if (request.method === 'POST') {
            if (!origin || origin === 'null' || !allowedOrigins.has(origin)) throw new DomainError('ORIGIN_REJECTED','A matching application origin is required.',403);
            const body=await bodyJson(request);
            const routes={'/api/auth/sign-in':'signIn','/api/auth/activate':'activate','/api/auth/recover':'recover','/api/auth/sign-out':'signOut'};
            if (routes[url.pathname]) { sendJson(response,200,await accounts[routes[url.pathname]](request,response,body)); return; }
            if (url.pathname === '/api/action') { sendJson(response,200,await accounts.action(request,body)); return; }
          }
          throw new DomainError('NOT_FOUND','API route not found.',404);
        }
        if (request.method === 'GET' && url.pathname === '/api/state') { actorId = url.searchParams.get('actorId') ?? 'admin'; sendJson(response, 200, { ok: true, state: store.view(actorId) }); return; }
        if (request.method === 'POST' && url.pathname === '/api/action') {
          const action = await bodyJson(request); actorId = action?.actorId ?? 'admin'; const result = await store.dispatch(action); sendJson(response, 200, result); return;
        }
        throw new DomainError('NOT_FOUND', 'API route not found.', 404);
      }
      if (!production) { sendJson(response, 404, { ok: false, error: { code: 'FRONTEND_SEPARATE', message: 'Use the Vite interface on port 4173, or build and start with --production.' } }); return; }
      if (!['GET', 'HEAD'].includes(request.method)) throw new DomainError('METHOD_NOT_ALLOWED', 'Method not allowed.', 405);
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new DomainError('INVALID_PATH', 'Malformed URL path.'); }
      let target = path.resolve(distDir, `.${pathname}`);
      if (target !== path.resolve(distDir) && !target.startsWith(`${path.resolve(distDir)}${path.sep}`)) throw new DomainError('INVALID_PATH', 'Invalid asset path.', 403);
      try { if (!(await stat(target)).isFile()) target = path.join(distDir, 'index.html'); }
      catch { if (path.extname(pathname)) throw new DomainError('NOT_FOUND', 'Asset not found.', 404); target = path.join(distDir, 'index.html'); }
      let bytes;
      try { bytes = await readFile(target); } catch { throw new DomainError('BUILD_REQUIRED', 'Build the frontend before starting production preview.', 503); }
      response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
      response.writeHead(200, { 'Content-Type': MIME[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control': path.basename(target) === 'index.html' ? 'no-cache' : 'public, max-age=3600' }); response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      const known = error instanceof DomainError; let state;
      // Do not leak state to an invalid origin, host, token or actor.
      if (store && authMode === 'demo' && known && !['HOST_REJECTED', 'ORIGIN_REJECTED', 'DESKTOP_SESSION_REQUIRED', 'UNKNOWN_ACTOR', 'AUTH_SETUP_REQUIRED'].includes(error.code)) { try { state = store.view(actorId); } catch {} }
      sendJson(response, known ? error.status : 500, { ok: false, error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : authMode === 'accounts' ? 'The remote result could not be confirmed. Check the saved result before retrying.' : 'Unexpected server error. Previous saved state is preserved.', details: known ? error.details : {} }, ...(state ? { state } : {}) });
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  // Tests may narrow binding to loopback; environment cannot broaden local mode.
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, options.loopbackOnly === true ? '127.0.0.1' : hosting.bind, resolve); });
  const actualPort = server.address().port;
  process.parentPort?.postMessage({ type: 'astra-server-ready', port: actualPort });
  const stop = () => server.close();
  process.parentPort?.on('message', async ({ data }) => { if (data?.type === 'astra-server-stop') { await store?.queue; server.close(() => process.exit(0)); } });
  return { server, store, accounts, authMode, port: actualPort, url: `http://127.0.0.1:${actualPort}`, stop };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer().then(({ url, authMode }) => console.log(`Astra local API (${authMode === 'demo' ? 'explicit synthetic demo' : 'accounts: setup required'}): ${url}`)).catch(error => { console.error(`Astra could not start: ${error.message}`); process.exitCode = 1; });
}
