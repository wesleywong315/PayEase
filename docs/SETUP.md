# TeamFair setup guide

This guide covers the local development foundation for TeamFair.

## Required tooling

- Node.js **20.19.0+** (Prisma ORM 7 and Next.js 15)
- npm (comes with Node.js)
- Git

Check your versions:

```bash
node -v
npm -v
```

This project was verified with Node.js `v24.19.0` and npm `11.17.0`.

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

`.env.example` contains a safe local SQLite URL:

```env
DATABASE_URL="file:./prisma/dev.db"
```

Do not commit your real `.env`. Do not put private configuration in `NEXT_PUBLIC_*` variables.

## Generate the Prisma Client

```bash
npm run db:generate
```

This writes the client to `src/generated/prisma` (gitignored). Re-run after schema changes.

## Apply migrations

```bash
npm run db:migrate
```

For the first migration on a fresh clone, Prisma may prompt for a migration name if none exist yet. After migrations are committed, the same command applies them to your local database.

Non-interactive alternative when creating a named migration:

```bash
npx prisma migrate dev --name <migration_name>
```

## Seed the database

```bash
npm run db:seed
```

The seed is idempotent. It upserts exactly one demo community:

- ID: `demo-community-hku-hall-football`
- Name: `HKU Hall Football Team`

Running the seed again will not create duplicates.

## Start the development server

```bash
npm run dev
```

Then open the local address printed in the terminal (usually `http://localhost:3000`).

Verify:

- Home page shows **TeamFair** and the seeded community name from the database
- `http://localhost:3000/api/health` returns HTTP 200 with `"database": "connected"`

## Run tests

```bash
npm run test
```

Current coverage includes environment validation (for example, rejecting an empty `DATABASE_URL`).

## Lint and typecheck

```bash
npm run lint
npm run typecheck
```

TypeScript checking covers application code, Prisma config, and the seed script.

## Production build

```bash
npm run build
npm run start
```

`build` runs `prisma generate` then `next build`.

## Teammate setup checklist

1. Clone the repository.
2. `cd` into the project root.
3. Install dependencies with `npm install`.
4. Copy `.env.example` to `.env` (do not share or commit your `.env`).
5. Generate the Prisma Client: `npm run db:generate`.
6. Apply migrations: `npm run db:migrate`.
7. Seed your local database: `npm run db:seed`.
8. Start the app: `npm run dev`.
9. Optionally run `npm run test`, `npm run lint`, and `npm run typecheck`.

Each teammate should use their own local SQLite file. Never commit `prisma/dev.db` or related journal/WAL files.

## Stack notes

- Next.js App Router with Route Handlers (`src/app/api/...`)
- Prisma ORM **7.10** with SQLite via `@prisma/adapter-better-sqlite3`
- Prisma CLI config lives in `prisma.config.ts`
- Zod validates environment/configuration for upcoming API work
- Vitest runs unit tests under `src/tests/`
