import type { Env } from './env';
import { Router } from './router';
import { apiError } from './lib/http';
import { log, newRequestId } from './lib/log';
import { requestMagicLink, verifyMagicLink, logout, me } from './routes/auth';
import { listUserDevices } from './routes/device';
import { uploadReport, getReportById, reportHistory, compareReportsRoute } from './routes/report';
import { analyzeReport } from './routes/analyze';
import { getUserSettings, updateUserSettings } from './routes/settings';
import { listProviders, upsertProvider, removeProvider } from './routes/providers';
import { exportReportRoute } from './routes/export';
import { listUsersRoute, getUserRoute, updateUserRoleRoute, updateUserStatusRoute } from './routes/users';
import { getAnalytics } from './routes/analytics';
import { getAuditLogs } from './routes/audit';
import { getSystemStatus } from './routes/system';
import { createScanTokenRoute } from './routes/scan';

export type { Env };

const router = new Router();

router.post('/api/v1/auth/magic-link', requestMagicLink);
router.get('/api/v1/auth/verify', verifyMagicLink);
router.post('/api/v1/auth/logout', logout);
router.get('/api/v1/auth/me', me);

router.get('/api/v1/device', listUserDevices);

router.post('/api/v1/scan-token', createScanTokenRoute);

router.post('/api/v1/report', uploadReport);
router.get('/api/v1/report/history', reportHistory);
router.get('/api/v1/report/compare', compareReportsRoute);
router.get('/api/v1/report/:id', getReportById);

router.post('/api/v1/analyze', analyzeReport);

router.get('/api/v1/settings', getUserSettings);
router.put('/api/v1/settings', updateUserSettings);

router.get('/api/v1/providers', listProviders);
router.post('/api/v1/providers', upsertProvider);
router.delete('/api/v1/providers/:provider', removeProvider);

router.get('/api/v1/export', exportReportRoute);

router.get('/api/v1/users', listUsersRoute);
router.get('/api/v1/users/:id', getUserRoute);
router.put('/api/v1/users/:id/role', updateUserRoleRoute);
router.put('/api/v1/users/:id/status', updateUserStatusRoute);

router.get('/api/v1/analytics', getAnalytics);
router.get('/api/v1/audit-logs', getAuditLogs);
router.get('/api/v1/system', getSystemStatus);

async function handleApi(request: Request, env: Env, requestId: string): Promise<Response> {
  const url = new URL(request.url);
  const route = router.match(request.method, url.pathname);
  if (!route) return apiError('not_found', `No route for ${request.method} ${url.pathname}.`);

  try {
    return await route.handler({ request, env, params: route.params, requestId });
  } catch (error) {
    log.error({ category: 'error', event: 'unhandled_route_error', requestId, path: url.pathname, error });
    return apiError('internal_error', 'Something went wrong. This has been logged.');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestId = newRequestId();
    const startedAt = Date.now();

    if (url.pathname === '/robots.txt') {
      return new Response(`User-agent: *\nAllow: /\nSitemap: ${url.origin}/sitemap.xml\n`, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (url.pathname === '/sitemap.xml') {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${url.origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>`,
        { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
      );
    }

    if (url.pathname.startsWith('/api/v1/')) {
      const response = await handleApi(request, env, requestId);
      log.info({ category: 'api', event: 'request', requestId, path: url.pathname, method: request.method, status: response.status, durationMs: Date.now() - startedAt });
      return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), 'Cache-Control': 'no-store', 'X-Request-Id': requestId } });
    }

    const isUnhashed = url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname === '/scan.mjs';

    // Cloudflare's edge cached these paths under an earlier deploy that
    // sent `public, max-age=31536000, immutable` (see the Cache-Control
    // comment below) — that cached copy predates this fix and won't
    // re-check the origin until its year-long TTL expires, no matter
    // what headers we return now. ai-check.drave-ai.workers.dev is
    // Cloudflare's own shared *.workers.dev zone, not one this account
    // owns, so there's no dashboard "Purge Cache" available on the Free
    // plan (see docs/DEPLOYMENT.md §Custom domain for the real fix —
    // moving to an owned zone). In the meantime, actively evict from the
    // Cache API on every request; each edge PoP self-heals the first
    // time a request lands there. Cache API is per-Worker-runtime, not
    // zone-scoped, so this works even without zone access.
    if (isUnhashed) {
      // `caches.default` is Cloudflare's runtime API; the WebWorker lib
      // pulled in for DOM fetch types doesn't declare it on CacheStorage.
      const defaultCache = (caches as unknown as { default: Cache }).default;
      await defaultCache.delete(new Request(url.origin + url.pathname, request));
    }

    // Route every request through the asset binding. This prevents the SPA
    // fallback from ever returning index.html in place of a CSS or JS asset.
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set(
      'Cache-Control',
      // `no-cache` still permits Cloudflare's edge to cache-and-revalidate,
      // which in practice served a stale index.html (with old, no-longer-
      // existing hashed asset filenames) for several minutes after a
      // deploy. The entry HTML is tiny and must always be current — its
      // whole job is pointing at the current hashed asset names — so it
      // gets `no-store` instead. Hashed assets underneath keep aggressive
      // immutable caching; a new deploy gives them new filenames anyway.
      // /scan.mjs is unhashed and rebuilt every deploy (the downloadable
      // .command file fetches it by fixed name — see ScanModal), so like
      // the entry HTML it must never be served stale.
      isUnhashed ? 'no-store' : 'public, max-age=31536000, immutable',
    );
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  },
};
