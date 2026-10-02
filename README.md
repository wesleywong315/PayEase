# PayEase

Fair shared spending for student teams (HKU HackU prototype).

Demo auth only — **no real payments**. Money is tracked as integer **HKD cents**.

**Database today:** local SQLite (`prisma/dev.db`).  
**When ready to share across devices:** Supabase Postgres + Railway — see [docs/DEPLOY.md](docs/DEPLOY.md).

## Requirements

- **Node.js** `20.19.0` or newer
- **npm** only (do not mix with pnpm or Yarn)

## Quick start (local SQLite)

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open the URL printed by Next.js (often [http://localhost:3000](http://localhost:3000); use another port if busy).

If styles look broken after a production build, clear the cache:

```bash
npm run dev:clean -- -p 3001
```

## What works now (Stages 1–5 product update)

1. Green landing → demo login → personal community inbox  
2. Create community / QR invitations / join confirmation (+ camera scan with paste fallback)  
3. Role-specific community nav, versioned rules (feature toggles + cycle budget cap), categories, expense draft/preview/commit with due dates  
4. Member payment ribbons, demo simulate → pending → coordinator confirm (ledger updates once), Updates feed  
5. Report category pie/donut, privacy filters on hardship/report charges  

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js development server |
| `npm run dev:clean` | Delete `.next` then start `next dev` |
| `npm run build` | Prisma generate + production build |
| `npm run start` | Production server (local) |
| `npm run start:prod` | Migrate deploy (Postgres only) + `next start` (Railway) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest |
| `npm run db:generate` | Prisma Client |
| `npm run db:migrate` | Local migrate dev (SQLite) |
| `npm run db:migrate:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | Idempotent demo seed |
| `npm run db:provider` | Print `sqlite` or `postgresql` from `DATABASE_URL` |

## Hosting (prepared, not required yet)

- Runtime picks **SQLite** or **Postgres** from `DATABASE_URL` shape ([`src/lib/db.ts`](src/lib/db.ts)).
- Dockerfile + [`railway.toml`](railway.toml) are ready for Railway.
- Cutover checklist (create Supabase → flip schema → deploy): **[docs/DEPLOY.md](docs/DEPLOY.md)**.

Until cutover, keep `DATABASE_URL="file:./prisma/dev.db"`.

## Demo walkthrough

1. Open `/` (green landing) → **Log in**  
2. Username/password (demo: `alex` / `demo`) **or** **Demo accounts** → pick Alex / Ben / Chloe / Dana  
3. **Create a new account** under Demo accounts → empty inbox, then create/join communities  
4. Log out returns to `/`  
5. Open **HKU Hall Football Team** → Invitations → create QR / link  
6. As Ben: Join → confirm → My payments → Demo / Simulate → Alex confirms  
7. Reports → category donut + table  

## Migrations

Applied under `prisma/migrations/` (SQLite):

- `init_community`
- `expand_payease_domain`
- `add_community_invitations`
- `stage3_to_5_domain`

Postgres baseline is created at cutover time (see DEPLOY.md). Reference schema: `prisma/schema.postgres.prisma`.

## Health

`GET /api/health` → `{ "status": "ok", "database": "connected" }`

## Spec

See [SPEC.md](SPEC.md), [docs/SETUP.md](docs/SETUP.md), and [docs/DEPLOY.md](docs/DEPLOY.md).
