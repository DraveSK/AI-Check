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

export type { Env };

const router = new Router();

router.post('/api/v1/auth/magic-link', requestMagicLink);
router.get('/api/v1/auth/verify', verifyMagicLink);
router.post('/api/v1/auth/logout', logout);
router.get('/api/v1/auth/me', me);

router.get('/api/v1/device', listUserDevices);

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

    // Route every request through the asset binding. This prevents the SPA
    // fallback from ever returning index.html in place of a CSS or JS asset.
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set(
      'Cache-Control',
      url.pathname === '/' || url.pathname.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    );
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  },
};
