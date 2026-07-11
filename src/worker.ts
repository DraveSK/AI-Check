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

    return env.ASSETS.fetch(request);
  },
};
