# TeamFair

Fair shared spending for student teams.

This repository currently contains the **local development foundation only**:
Next.js (App Router), TypeScript, Tailwind CSS, Prisma + SQLite, Zod, and Vitest.
Bill splitting, payments, hardship support, withdrawals, and reports are not implemented yet.

## Requirements

- **Node.js** `20.19.0` or newer (tested with Node.js `24.19.0`)
- **npm** (do not mix with pnpm or Yarn)

Run all commands from the project root (the directory that contains `package.json`).

## Quick start

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open the URL printed by Next.js (typically [http://localhost:3000](http://localhost:3000)).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Generate Prisma Client and create a production build |
| `npm run start` | Start the production server (after `build`) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript (`tsc --noEmit`) |
| `npm run test` | Run Vitest unit tests |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create/apply Prisma migrations locally |
| `npm run db:seed` | Seed the demo community (idempotent) |

## Health check

`GET /api/health` performs a lightweight database query and returns:

```json
{ "status": "ok", "database": "connected" }
```

## Teammate setup

See [docs/SETUP.md](docs/SETUP.md) for a full walkthrough.
