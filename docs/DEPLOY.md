# Deploy: Supabase Postgres + Railway

PayEase still defaults to **local SQLite** for development. Use this guide when
features are finished and you want a shared database + public URL.

Do **not** run destructive migrations (`migrate reset`) against Supabase without
an explicit team decision.

## Architecture

```text
Browsers  →  Railway (Next.js)  →  Supabase Postgres
Local optional .env can also point at the same Supabase DB.
```

Runtime already selects adapters from `DATABASE_URL`:

| URL shape | Adapter |
| --- | --- |
| `file:…` / `:memory:` | `@prisma/adapter-better-sqlite3` |
| `postgresql://` / `postgres://` | `@prisma/adapter-pg` + `pg` |

Check what the current env would use:

```bash
npm run db:provider
```

## 1. Create a Supabase project

1. Open [https://supabase.com](https://supabase.com) and create a free project.
2. Project Settings → Database → Connection string.
3. Copy:
   - **Transaction pooler** URI (port **6543**, often includes `?pgbouncer=true`) → `DATABASE_URL`
   - **Direct** URI (port **5432**) → `DIRECT_URL` (migrations)
4. Prefer the URI that includes a password; reset DB password if needed.

## 2. Flip Prisma to PostgreSQL (one-time cutover)

While developing, [`prisma/schema.prisma`](../prisma/schema.prisma) stays on `provider = "sqlite"`.

Reference schema with Postgres provider: [`prisma/schema.postgres.prisma`](../prisma/schema.postgres.prisma).

Cutover steps (on a clean branch, with Supabase URLs in `.env` temporarily):

```bash
# 1) Point schema at Postgres
cp prisma/schema.postgres.prisma prisma/schema.prisma
# Edit if needed so datasource provider is "postgresql"

# 2) Archive SQLite migrations (keep for history)
mkdir -p prisma/migrations_sqlite_archive
mv prisma/migrations/* prisma/migrations_sqlite_archive/ 2>/dev/null || true

# 3) Create a fresh Postgres baseline from the schema
# Use DIRECT_URL for migrate tooling:
export DATABASE_URL="$DIRECT_URL"
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/payease_pg_baseline.sql
mkdir -p prisma/migrations/00000000000000_init_postgres
mv /tmp/payease_pg_baseline.sql prisma/migrations/00000000000000_init_postgres/migration.sql

# 4) Apply + generate + seed (demo data is intentional for the hackathon)
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

Restore app `DATABASE_URL` to the **pooler** URL for runtime; keep `DIRECT_URL` for migrate.

`scripts/start-prod.js` runs `prisma migrate deploy` using `DIRECT_URL` when set, then `next start`.

## 3. Deploy on Railway

You already have a Railway account.

1. New Project → Deploy from GitHub (or CLI) using this repo.
2. Builder: Dockerfile ([`Dockerfile`](../Dockerfile) + [`railway.toml`](../railway.toml)).
3. Set variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **pooler** URI |
| `DIRECT_URL` | Supabase **direct** URI |
| `SESSION_SECRET` | random ≥16 chars (shared by all instances) |
| `NODE_ENV` | `production` |

4. Deploy. Health check: `GET /api/health`.
5. Open the Railway public URL. Log in as a demo user; confirm inbox loads.
6. From a second device/network, repeat — data should match (shared Supabase).

Optional: after deploy, run seed once via Railway one-off / local against `DIRECT_URL`:

```bash
DATABASE_URL="$DIRECT_URL" npm run db:seed
```

## 4. Team usage after cutover

- Share the **Railway URL**, not localhost.
- Do not rely on `prisma/dev.db` as shared truth.
- Demo auth cookies are host-scoped to the Railway domain.
- Keep SQLite only for offline solo experiments if needed (separate `.env`).

## 5. Local prep without cutting over

Default remains:

```env
DATABASE_URL="file:./prisma/dev.db"
SESSION_SECRET="payease-local-dev-session-secret"
```

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

## Rollback notes

- Railway: redeploy previous image / unset Postgres URL only if you also revert schema to sqlite (not recommended mid-demo).
- Supabase: pause project or rotate DB password if credentials leak.
- Never commit real `.env` values.
