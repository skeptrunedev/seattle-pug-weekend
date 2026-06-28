// ---------- Seattle Pug Weekend · companion app ----------
// State is shared for everyone via /api/checks (Cloudflare D1).
// localStorage is just a cache so the UI paints instantly + survives offline.
const CACHE = 'spw-cache-v1';
const SECTIONS = {
  parking: ['pk-discover', 'pk-tickets', 'pk-greenlake'],
  hike:    ['hk-water', 'hk-snacks', 'hk-wear', 'hk-misc'],
  lunch:   ['ln-call'],
  fishing: ['fs-license', 'fs-order', 'fs-home'],
};
const TOTAL = Object.values(SECTIONS).flat().length;
const RING_LEN = 2 * Math.PI * 52; // r=52

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- state (cache-first, server-authoritative) ----------
let state = {};
try { state = JSON.parse(localStorage.getItem(CACHE)) || {}; } catch { state = {}; }
const cache = () => localStorage.setItem(CACHE, JSON.stringify(state));

async function pull() {
  try {
    const r = await fetch('/api/checks', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const server = await r.json();
    state = server;            // server is the source of truth
    cache();
    syncInputs();
    render();
    setStatus(true);
  } catch (e) {
    setStatus(false);          // offline / no API (e.g. plain static preview)
  }
}
async function push(id, checked) {
  try {
    const r = await fetch('/api/checks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, checked }),
    });
    setStatus(r.ok);
  } catch { setStatus(false); }
}
function setStatus(online) {
  const el = $('#sync');
  if (!el) return;
  el.textContent = online ? 'synced' : 'offline';
  el.classList.toggle('off', !online);
}

// ---------- navigation ----------
const SCREENS = { home: 1, ...SECTIONS };
function go(name) {
  if (!(name in SCREENS)) name = 'home';
  $$('.screen').forEach(s => s.classList.toggle('is-active', s.dataset.screen === name));
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.go === name));
  $('#screens').scrollTop = 0;
  history.replaceState(null, '', '#' + name);
}
$$('[data-go]').forEach(el => el.addEventListener('click', () => go(el.dataset.go)));

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
    push(id, input.checked);            // persist for everyone
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

// ---------- countdown ----------
function tick() {
  const now = new Date();
  const trip = new Date('2026-07-11T08:00:00-07:00');
  const days = Math.ceil((trip - now) / 86400000);
  $('#countdown').textContent =
    days > 1 ? `🐾 ${days} days to Seattle` :
    days === 1 ? '🐾 tomorrow!' :
    days === 0 ? "🐾 it's the weekend!" : '🐾 hope it was great';
}

// ---------- boot ----------
go((location.hash || '#home').slice(1));
syncInputs();
render();
tick();
setInterval(tick, 30000);
pull();                                   // hydrate from server
setInterval(pull, 20000);                 // keep in sync with the other person
window.addEventListener('focus', pull);
document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
