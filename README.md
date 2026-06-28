# 🐾 Seattle Weekend

A playful, mobile-app-style companion site for a weekend in Seattle — tracking
the actual meat-and-potatoes logistics so the trip goes smoothly: parking for
each stop, the Saturday hike + lunch, Evergreen Speedway, and Sunday fishing at
Green Lake.

It's an installable PWA with a **shared checklist** — everyone on the trip sees
the same checkmarks, and (if they opt in) gets a **push notification** when
something gets checked off, even with the app closed.

🔗 **Live:** https://seattle.skeptrune.com

## Stack

- **Frontend:** plain HTML/CSS/JS, monospace + warm "Pugliee" palette. Bottom-tab
  nav on mobile, a left-rail dashboard on desktop. Installable PWA + offline
  shell via a service worker.
- **API:** [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
  (`functions/api/*`).
- **Storage:** [Cloudflare D1](https://developers.cloudflare.com/d1/) (serverless
  SQLite) — shared checklist state + push subscriptions. No accounts needed.
- **Notifications:** Web Push (VAPID) via
  [`@block65/webcrypto-web-push`](https://www.npmjs.com/package/@block65/webcrypto-web-push),
  sent from the Function after each change to every *other* device.
- `localStorage` caches state for instant paint; D1 is the source of truth and
  the UI polls every couple seconds for near-realtime sync.

## Develop locally

```bash
npm install                                # push library (bundled into Functions)
npx wrangler d1 execute pug-weekend --local --file=./schema.sql   # local SQLite
cp .dev.vars.example .dev.vars             # then fill in VAPID keys (see below)
npx wrangler pages dev . --port 8787       # site + API + local DB
```

### API

| Method | Route            | Body                          | Returns                  |
|-------:|------------------|-------------------------------|--------------------------|
| GET    | `/api/checks`    | —                             | `{ "<id>": true, ... }`  |
| POST   | `/api/checks`    | `{ id, checked, clientId }`   | `{ ok, id, checked }` + push to others |
| POST   | `/api/subscribe` | `{ subscription, clientId }`  | `{ ok }`                 |
| DELETE | `/api/subscribe` | `{ endpoint }`                | `{ ok }`                 |

Task ids are allow-listed server-side in `functions/api/checks.js`.

## VAPID keys (for Web Push)

```bash
npx web-push generate-vapid-keys --json
```

- Put the **public** key in `app.js` (`VAPID_PUBLIC`) — it's meant to be public.
- Keep the **private** key out of git: in `.dev.vars` locally and as a Pages
  secret in production. `.dev.vars` is gitignored.

## Deploy (Cloudflare Pages + D1)

```bash
# one-time
npx wrangler d1 create pug-weekend
npx wrangler d1 execute pug-weekend --remote --file=./schema.sql
npx wrangler pages secret put VAPID_PRIVATE_KEY  --project-name seattle-pug-weekend
npx wrangler pages secret put VAPID_PUBLIC_KEY   --project-name seattle-pug-weekend
npx wrangler pages secret put VAPID_SUBJECT      --project-name seattle-pug-weekend

# every deploy: assemble the clean output dir, then publish
./build.sh                                  # -> dist/ (public files only)
npx wrangler pages deploy --branch main     # uploads dist/, compiles functions/
```

`build.sh` keeps the published output to just the app — the third-party sticker
pack, `node_modules`, drafts, and config never go to the CDN.

## Art

UI illustrations are generated in the cozy "Pugliee" style. The original
third-party Puglie sticker pack is **not** included in this repo.

## License

[MIT](./LICENSE) © 2026 Nick Khami
