# 🐾 Seattle Pug Weekend

A playful, mobile-app-style companion site for a weekend in Seattle — tracking
the actual meat-and-potatoes logistics so the trip goes smoothly: parking for
each stop, the Saturday hike + lunch, Evergreen Speedway, and Sunday fishing at
Green Lake.

Built as a tiny static app with a **shared checklist** — everyone on the trip
sees the same checkmarks in real time.

🔗 **Live:** https://seattle.skeptrune.com

## Stack

- **Frontend:** plain HTML/CSS/JS, monospace + warm "Pugliee" palette, bottom-tab
  navigation on mobile and a left-rail dashboard on desktop.
- **API:** [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
  (`functions/api/checks.js`).
- **Storage:** [Cloudflare D1](https://developers.cloudflare.com/d1/) (serverless
  SQLite) — one shared row per task, no accounts needed.
- `localStorage` is used only as an instant cache; D1 is the source of truth.

## Develop locally

```bash
# 1. create the local D1 schema (uses a local SQLite under .wrangler/)
npx wrangler d1 execute pug-weekend --local --file=./schema.sql

# 2. run the site + API + local DB together
npx wrangler pages dev . --port 8787
# open http://localhost:8787
```

### API

| Method | Route          | Body                       | Returns                       |
|-------:|----------------|----------------------------|-------------------------------|
| GET    | `/api/checks`  | —                          | `{ "<id>": true, ... }`       |
| POST   | `/api/checks`  | `{ "id", "checked" }`      | `{ ok, id, checked }`         |

Task ids are allow-listed server-side in `functions/api/checks.js`.

## Deploy (Cloudflare Pages + D1)

```bash
# one-time: create the production database, then put its id in wrangler.toml
npx wrangler d1 create pug-weekend
npx wrangler d1 execute pug-weekend --remote --file=./schema.sql

# deploy
npx wrangler pages deploy .
```

Bind the D1 database (binding name `DB`) to the Pages project, and point the
custom domain at it.

## Art

UI illustrations are generated in the cozy "Pugliee" style. The original
third-party Puglie sticker pack is **not** included in this repo.

## License

[MIT](./LICENSE) © 2026 Nick Khami
