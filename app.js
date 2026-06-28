// ---------- Seattle Weekend · companion app ----------
// State is shared for everyone via /api/checks (Cloudflare D1).
// Cross-device alerts use Web Push; localStorage caches state for instant paint.
const CACHE = 'spw-cache-v1';
const NOTIF_PREF = 'spw-notif';
const VAPID_PUBLIC = 'BFSu8U-LDVea9hFmAMQ9XHoaYfvPkmlXcllv7o1eqki9F7OABINKmDBHr4wLfVRasPOll4m6P3Y0tdheYOEkUrc';

const SECTIONS = {
  parking: ['pk-discover', 'pk-greenlake'],
  hike:    ['hk-water', 'hk-snacks', 'hk-wear', 'hk-misc', 'ln-call'],
  race:    ['pk-tickets'],
  fishing: ['fs-license', 'fs-order', 'fs-home'],
  smores:  ['sm-firewood', 'sm-sweet', 'sm-savory'],
};
const TOTAL = Object.values(SECTIONS).flat().length;
const RING_LEN = 2 * Math.PI * 52; // r=52

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// stable per-device id so the server can skip notifying the device that acted
let CLIENT_ID = localStorage.getItem('spw-cid');
if (!CLIENT_ID) {
  CLIENT_ID = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
  localStorage.setItem('spw-cid', CLIENT_ID);
}

// ---------- state (cache-first, server-authoritative) ----------
let state = {};
try { state = JSON.parse(localStorage.getItem(CACHE)) || {}; } catch { state = {}; }
const cache = () => localStorage.setItem(CACHE, JSON.stringify(state));

async function pull() {
  try {
    const r = await fetch('/api/checks', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    state = await r.json();            // server is the source of truth
    cache();
    syncInputs();
    render();
  } catch (e) { /* offline — keep cached state */ }
}
async function push(id, checked) {
  try {
    await fetch('/api/checks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, checked, clientId: CLIENT_ID }),
    });
  } catch { /* reconciles on next pull */ }
}

// ---------- navigation (history-aware so Back / swipe-back works) ----------
const SCREENS = { home: 1, ...SECTIONS };
function setScreen(name) {
  if (!(name in SCREENS)) name = 'home';
  $$('.screen').forEach(s => s.classList.toggle('is-active', s.dataset.screen === name));
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.go === name));
  $('#screens').scrollTop = 0;
}
function go(name) {
  if (!(name in SCREENS)) name = 'home';
  if (location.hash.slice(1) !== name) history.pushState({ name }, '', '#' + name);
  setScreen(name);
}
$$('[data-go]').forEach(el => el.addEventListener('click', () => go(el.dataset.go)));
// Back/forward (incl. iOS/Android swipe) restores the previous screen
window.addEventListener('popstate', () => setScreen((location.hash || '#home').slice(1)));

// ---------- checkboxes ----------
function syncInputs() {
  $$('.check input[type=checkbox]').forEach(i => { i.checked = !!state[i.dataset.id]; });
}
$$('.check input[type=checkbox]').forEach(input => {
  input.addEventListener('change', () => {
    const id = input.dataset.id;
    state[id] = input.checked;          // optimistic
    cache();
    const row = input.closest('.check');
    row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump');
    const before = completedSections.size;
    syncInputs();                       // keep home-list + section twins in lockstep
    render();
    if (input.checked) maybeCelebrate(id, before);
    push(id, input.checked);            // persist + notify everyone else
  });
});

// ---------- progress ----------
let completedSections = new Set();
function render() {
  let total = 0;
  completedSections = new Set();
  for (const [name, ids] of Object.entries(SECTIONS)) {
    const done = ids.filter(id => state[id]).length;
    total += done;
    const full = done === ids.length;
    if (full) completedSections.add(name);
    $$(`[data-prog="${name}"]`).forEach(el => {
      el.textContent = el.classList.contains('screen-prog')
        ? `${done}/${ids.length} ${full ? 'done ✓' : 'sorted'}`
        : `${done}/${ids.length}`;
    });
    const tile = $(`.tile[data-go="${name}"]`);
    if (tile) tile.classList.toggle('done', full);
  }
  const pct = Math.round((total / TOTAL) * 100);
  $('#ring-fg').style.strokeDashoffset = RING_LEN * (1 - total / TOTAL);
  $('#readiness-pct').textContent = pct + '%';
  $('#readiness-sub').textContent =
    total === TOTAL ? 'all set — good pug 🐾' : `${total} / ${TOTAL} done · keep going`;
}

// ---------- celebration ----------
function pawConfetti(n = 18) {
  const layer = $('#confetti');
  const glyphs = ['🐾', '🐾', '🐾', '🦴', '❤️'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.textContent = glyphs[i % glyphs.length];
    s.style.left = Math.random() * 100 + '%';
    s.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
    s.style.animationDelay = Math.random() * 0.3 + 's';
    s.style.fontSize = 0.9 + Math.random() * 1.1 + 'rem';
    layer.appendChild(s);
    setTimeout(() => s.remove(), 3400);
  }
}
function cheer(text) {
  const el = $('#cheer');
  $('#cheer-text').textContent = text;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function maybeCelebrate(id, prevCompleteCount) {
  if (Object.values(SECTIONS).flat().every(x => state[x])) {
    pawConfetti(40); cheer('weekend ready! 🐾'); return;
  }
  if (completedSections.size > prevCompleteCount) {
    const name = Object.keys(SECTIONS).find(n => SECTIONS[n].includes(id) && completedSections.has(n));
    if (name) { pawConfetti(16); cheer(`${name} sorted! 🐾`); }
  }
}

// ---------- web push notifications ----------
let swReg = null;
function notifsOn() {
  // Default ON forever once permission is granted — only off if explicitly disabled.
  return 'Notification' in window && Notification.permission === 'granted' &&
    localStorage.getItem(NOTIF_PREF) !== '0';
}
function showNotif(title, body) {
  const opts = { body, icon: '/icon-192.png', badge: '/favicon-32.png', tag: 'spw-checks' };
  if (swReg && swReg.showNotification) swReg.showNotification(title, opts);
  else try { new Notification(title, opts); } catch {}
}
function urlB64ToU8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToU8(VAPID_PUBLIC),
      });
    }
    await fetch('/api/subscribe', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON ? sub.toJSON() : sub, clientId: CLIENT_ID }),
    });
  } catch { /* push unsupported / blocked */ }
}
async function unsubscribePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/subscribe', {
        method: 'DELETE', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch {}
}
function paintNotifBtn() {
  const btn = $('#notif-btn');
  if (!btn) return;
  if (!('Notification' in window)) { btn.hidden = true; return; }
  if (notifsOn()) { btn.textContent = '🔔 On'; btn.classList.add('on'); }
  else { btn.textContent = '🔔 Notify'; btn.classList.remove('on'); }
}
async function toggleNotifs() {
  if (!('Notification' in window)) return;
  if (notifsOn()) { localStorage.setItem(NOTIF_PREF, '0'); await unsubscribePush(); paintNotifBtn(); return; }
  let perm = Notification.permission;
  if (perm !== 'granted') perm = await Notification.requestPermission();
  if (perm === 'granted') {
    localStorage.removeItem(NOTIF_PREF);        // back to default ON (forever)
    await subscribeToPush();
    showNotif('🐾 Notifications on', "You'll see when things get checked off.");
  }
  paintNotifBtn();
}
$('#notif-btn')?.addEventListener('click', toggleNotifs);

// ---------- install (PWA) ----------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e;
  const b = $('#install-btn'); if (b) b.hidden = false;
});
$('#install-btn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('#install-btn').hidden = true;
});
window.addEventListener('appinstalled', () => { const b = $('#install-btn'); if (b) b.hidden = true; });

// ---------- countdown ----------
function tick() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const trip = new Date(2026, 6, 11);     // Jul 11, 2026 — strict calendar-day count
  const days = Math.round((trip - today) / 86400000);
  $('#countdown').textContent =
    days > 1 ? `🐾 ${days} days to Seattle` :
    days === 1 ? '🐾 tomorrow!' :
    days === 0 ? "🐾 it's the weekend!" : '🐾 hope it was great';
}

// ---------- boot ----------
{
  const initial = ((location.hash || '#home').slice(1) in SCREENS) ? location.hash.slice(1) : 'home';
  history.replaceState({ name: initial }, '', '#' + initial);
  setScreen(initial);
}
syncInputs();
render();
paintNotifBtn();
tick();
setInterval(tick, 30000);
pull();                                   // hydrate from server
// near-realtime sync: poll fast while you're looking, gentler when backgrounded
let pollTimer = null;
function schedulePoll() {
  clearTimeout(pollTimer);
  const delay = document.hidden ? 10000 : 2500;
  pollTimer = setTimeout(async () => { await pull(); schedulePoll(); }, delay);
}
schedulePoll();
window.addEventListener('focus', pull);
document.addEventListener('visibilitychange', () => { schedulePoll(); if (!document.hidden) pull(); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      swReg = reg;
      if (notifsOn()) subscribeToPush();    // keep the push subscription fresh (default-on)
    }).catch(() => {});
  });
}
