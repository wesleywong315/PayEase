# PayEase setup guide

This guide covers **local development** (SQLite). For shared hosting later, see [DEPLOY.md](DEPLOY.md).

## Required tooling

- Node.js **20.19.0+** (Prisma ORM 7 and Next.js 15)
- npm (comes with Node.js)
- Git

Check your versions:

```bash
node -v
npm -v
```

Do **not** mix package managers. Use npm only.

## Where to run commands

Always run commands from the **project root** — the folder that contains:

- `package.json`
- `prisma.config.ts`
- `.env` / `.env.example`

Database paths are resolved relative to that root (`file:./prisma/dev.db`).

## Install dependencies

```bash
npm install
```

Native modules such as `better-sqlite3` need their install scripts allowed. If npm reports pending install scripts, approve them for this project before continuing.

## Create your local environment file

```bash
cp .env.example .env
```

`.env.example` defaults to local SQLite:

```env
DATABASE_URL="file:./prisma/dev.db"
SESSION_SECRET="payease-local-dev-session-secret"
```

Leave Supabase `DATABASE_URL` / `DIRECT_URL` commented until cutover ([DEPLOY.md](DEPLOY.md)).

Do not commit your real `.env`. Do not put private configuration in `NEXT_PUBLIC_*` variables.

Confirm the adapter selection:

```bash
npm run db:provider
# → sqlite
```

## Generate the Prisma Client

```bash
npm run db:generate
```

This writes the client to `src/generated/prisma` (gitignored). Re-run after schema changes.

## Apply migrations

```bash
npm run db:migrate
```

Non-interactive alternative when creating a named migration:

```bash
npx prisma migrate dev --name <migration_name>
```

## Seed the database

```bash
npm run db:seed
```

The seed is idempotent (stable demo IDs). It works with SQLite now and with Postgres after cutover (same script via `createPrismaClient()`).

## Start the development server

```bash
npm run dev
```

Then open the local address printed in the terminal (usually `http://localhost:3000`).

Verify:

- Home page shows **PayEase**
- `http://localhost:3000/api/health` returns HTTP 200 with `"database": "connected"`

## Run tests

```bash
npm run test
```

## Lint and typecheck

```bash
npm run lint
npm run typecheck
```

## Production build (local)

```bash
npm run build
npm run start
```

Railway uses `npm run start:prod` (migrate deploy on Postgres, then `next start`). See [DEPLOY.md](DEPLOY.md).

## Teammate setup checklist (local)

1. Clone the repository.
2. `cd` into the project root.
3. Install dependencies with `npm install`.
4. Copy `.env.example` to `.env` (do not share or commit your `.env`).
5. Generate the Prisma Client: `npm run db:generate`.
6. Apply migrations: `npm run db:migrate`.
7. Seed your local database: `npm run db:seed`.
8. Start the app: `npm run dev`.
9. Optionally run `npm run test`, `npm run lint`, and `npm run typecheck`.

Each teammate should use their own local SQLite file until the team cuts over to Supabase. Never commit `prisma/dev.db`.

## Stack notes

- Next.js App Router with Route Handlers (`src/app/api/...`)
- Prisma ORM **7.10** — SQLite via `@prisma/adapter-better-sqlite3` locally; Postgres via `@prisma/adapter-pg` when `DATABASE_URL` is `postgresql://…`
- Prisma CLI config lives in `prisma.config.ts`
- Zod validates environment configuration
- Vitest runs unit tests under `src/tests/`
