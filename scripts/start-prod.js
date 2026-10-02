#!/usr/bin/env node
/**
 * Production entry: apply Postgres migrations when DATABASE_URL is postgresql,
 * then start Next.js. Local SQLite keeps using `npm run db:migrate` / `npm run start`.
 */
const { spawn } = require("node:child_process");

function detectProvider(url) {
  const trimmed = String(url || "").trim().toLowerCase();
  if (trimmed.startsWith("postgres://") || trimmed.startsWith("postgresql://")) {
    return "postgresql";
  }
  return "sqlite";
}

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env,
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const provider = detectProvider(databaseUrl);
  if (provider === "postgresql") {
    // Prefer DIRECT_URL for migrate when using Supabase pooler.
    const migrateEnv = { ...process.env };
    if (process.env.DIRECT_URL) {
      migrateEnv.DATABASE_URL = process.env.DIRECT_URL;
    }
    console.log("[start:prod] Running prisma migrate deploy (postgresql)…");
    await run("npx", ["prisma", "migrate", "deploy"], migrateEnv);
  } else {
    console.log(
      "[start:prod] Skipping migrate deploy for non-Postgres DATABASE_URL.",
    );
  }

  const port = process.env.PORT || "3000";
  console.log(`[start:prod] Starting Next.js on port ${port}…`);
  await run("npx", ["next", "start", "-p", String(port)]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
