// Recent check-off activity feed (newest first) for the in-app notifications bell.
// GET /api/activity -> [{ id, item, checked, label, created_at }, ...]

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare('SELECT id, item, checked, label, created_at FROM activity ORDER BY id DESC LIMIT 50')
    .all();
  const list = (results || []).map((r) => ({
    id: r.id, item: r.item, checked: !!r.checked, label: r.label, created_at: r.created_at,
  }));
  return new Response(JSON.stringify(list), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
