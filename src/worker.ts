export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/robots.txt') {
      return new Response(`User-agent: *\nAllow: /\nSitemap: ${url.origin}/sitemap.xml\n`, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (url.pathname === '/sitemap.xml') {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${url.origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>`, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }

    if (url.pathname === '/api/inspections' && request.method === 'GET') {
      return json({
        data: { device: 'MacBook Pro', healthScore: 92, status: 'healthy' },
        meta: { source: 'demo', generatedAt: new Date().toISOString() },
      });
    }

    if (url.pathname === '/api/inspections' && request.method === 'POST') {
      const report = await request.json().catch(() => null);
      if (!report) return json({ error: 'A JSON inspection report is required.' }, 400);
      return json({ data: { id: crypto.randomUUID(), accepted: true } }, 201);
    }

    // Route every request through the asset binding. This prevents the SPA
    // fallback from ever returning index.html in place of a CSS or JS asset.
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set(
      'Cache-Control',
      url.pathname === '/' || url.pathname.endsWith('.html')
        ? 'no-cache'
        : 'public, max-age=31536000, immutable',
    );
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  },
};
