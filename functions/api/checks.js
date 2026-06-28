// Shared checklist state for everyone — backed by Cloudflare D1 (SQLite).
// GET  /api/checks        -> { "pk-discover": true, ... }
// POST /api/checks {id,checked} -> upsert one item, returns { ok, id, checked }

const VALID = new Set([
  'pk-discover', 'pk-tickets', 'pk-greenlake',
  'hk-water', 'hk-snacks', 'hk-wear', 'hk-misc',
  'ln-call',
  'fs-license', 'fs-order', 'fs-home',
]);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare('SELECT id, checked FROM checks').all();
  const state = {};
  for (const r of results) state[r.id] = !!r.checked;
  return json(state);
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const { id, checked } = body || {};
  if (!VALID.has(id)) return json({ error: 'unknown id' }, 400);
  await env.DB
    .prepare(`INSERT INTO checks (id, checked, updated_at) VALUES (?1, ?2, datetime('now'))
              ON CONFLICT(id) DO UPDATE SET checked = ?2, updated_at = datetime('now')`)
    .bind(id, checked ? 1 : 0)
    .run();
  return json({ ok: true, id, checked: !!checked });
}
