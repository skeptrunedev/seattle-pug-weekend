// Store / remove Web Push subscriptions (Cloudflare D1).
// POST   /api/subscribe { subscription, clientId }  -> upsert
// DELETE /api/subscribe { endpoint }                -> remove

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const { subscription, clientId } = body || {};
  if (!subscription || !subscription.endpoint) return json({ error: 'no subscription' }, 400);
  await env.DB
    .prepare(`INSERT INTO push_subs (endpoint, sub, client_id, created_at)
              VALUES (?1, ?2, ?3, datetime('now'))
              ON CONFLICT(endpoint) DO UPDATE SET sub = ?2, client_id = ?3`)
    .bind(subscription.endpoint, JSON.stringify(subscription), clientId || null)
    .run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!body?.endpoint) return json({ error: 'no endpoint' }, 400);
  await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?1').bind(body.endpoint).run();
  return json({ ok: true });
}
