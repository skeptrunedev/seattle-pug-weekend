// Shared checklist state for everyone — backed by Cloudflare D1 (SQLite).
// GET  /api/checks                       -> { "pk-discover": true, ... }
// POST /api/checks {id,checked,clientId}  -> upsert + Web Push to other devices

import { buildPushPayload } from '@block65/webcrypto-web-push';

const VALID = new Set([
  'pk-discover', 'pk-tickets', 'pk-greenlake',
  'hk-water', 'hk-snacks', 'hk-wear', 'hk-misc',
  'ln-call',
  'fs-license', 'fs-order', 'fs-home',
  'sm-firewood', 'sm-sweet', 'sm-savory',
]);

const LABELS = {
  'pk-discover': 'Discover Pass', 'pk-tickets': 'Speedway tickets', 'pk-greenlake': 'Green Lake parking',
  'hk-water': 'Water (2 L)', 'hk-snacks': 'Trail snacks', 'hk-wear': 'Shoes · layer · sun', 'hk-misc': 'Phone · bandaids · bag',
  'ln-call': "Call Twede's",
  'fs-license': 'Fishing licenses', 'fs-order': 'Amazon gear', 'fs-home': 'Tackle from home',
  'sm-firewood': 'Firewood + sticks', 'sm-sweet': "Cookie-dough s'mores", 'sm-savory': 'Savory s\'mores',
};

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

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const { id, checked, clientId } = body || {};
  if (!VALID.has(id)) return json({ error: 'unknown id' }, 400);
  await env.DB
    .prepare(`INSERT INTO checks (id, checked, updated_at) VALUES (?1, ?2, datetime('now'))
              ON CONFLICT(id) DO UPDATE SET checked = ?2, updated_at = datetime('now')`)
    .bind(id, checked ? 1 : 0)
    .run();
  // Append to the activity feed (history shown in the in-app bell).
  await env.DB
    .prepare(`INSERT INTO activity (item, checked, label, created_at) VALUES (?1, ?2, ?3, datetime('now'))`)
    .bind(id, checked ? 1 : 0, LABELS[id] || id)
    .run();
  // Notify everyone else's devices in the background.
  context.waitUntil(sendPush(env, id, !!checked, clientId));
  return json({ ok: true, id, checked: !!checked });
}

async function sendPush(env, id, checked, actorClientId) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;
  const vapid = {
    subject: env.VAPID_SUBJECT || 'mailto:hello@skeptrune.com',
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const { results } = await env.DB.prepare('SELECT endpoint, sub, client_id FROM push_subs').all();
  const message = {
    data: { title: '🐾 Seattle Weekend', body: `${LABELS[id] || id} ${checked ? 'checked off ✓' : 'unchecked'}` },
    options: { ttl: 600, urgency: 'high' },
  };
  await Promise.all((results || []).map(async (row) => {
    if (actorClientId && row.client_id === actorClientId) return; // skip the device that made the change
    let subscription;
    try { subscription = JSON.parse(row.sub); } catch { return; }
    try {
      const payload = await buildPushPayload(message, subscription, vapid);
      const res = await fetch(subscription.endpoint, payload);
      if (res.status === 404 || res.status === 410) {
        await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?1').bind(row.endpoint).run();
      }
    } catch { /* ignore individual failures */ }
  }));
}
