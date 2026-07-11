export interface Env { DB: D1Database; REPORTS: R2Bucket }

/** Cloudflare Pages Function: stable JSON boundary for device scanners and AI services. */
export const onRequestGet: PagesFunction<Env> = async () => {
  return Response.json({
    data: { device: 'MacBook Pro', healthScore: 92, status: 'healthy' },
    meta: { source: 'demo', generatedAt: new Date().toISOString() },
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const report = await request.json();
  const id = crypto.randomUUID();
  await env.REPORTS.put(`reports/${id}.json`, JSON.stringify(report), {
    httpMetadata: { contentType: 'application/json' },
  });
  return Response.json({ data: { id, accepted: true } }, { status: 201 });
};
