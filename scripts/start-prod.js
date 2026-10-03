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

function describeDbTarget(url) {
  const t = String(url || "").toLowerCase();
  if (t.includes(":6543")) return "transaction-pooler";
  if (t.includes("pooler.supabase.com")) return "session-pooler";
  if (t.includes(":5432")) return "direct";
  return "postgres";
}

/** Session-mode pooler: same host as transaction pooler, port 5432. */
function toSessionPoolerUrl(url) {
  if (!url) return "";
  let next = String(url).replace(":6543", ":5432");
  next = next.replace(/[?&]pgbouncer=true/gi, "");
  next = next.replace(/\?&/, "?").replace(/[?&]$/, "");
  return next;
}

function uniqueUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
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

async function migrateDeploy(urls) {
  let lastError;
  for (const url of urls) {
    const label = describeDbTarget(url);
    console.log(`[start:prod] Running prisma migrate deploy (${label})…`);
    try {
      await run("npx", ["prisma", "migrate", "deploy"], {
        ...process.env,
        DATABASE_URL: url,
      });
      return;
    } catch (err) {
      lastError = err;
      console.error(
        `[start:prod] migrate deploy failed via ${label}; trying next connection if any.`,
      );
    }
  }
  throw lastError || new Error("prisma migrate deploy failed");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const provider = detectProvider(databaseUrl);
  if (provider === "postgresql") {
    await migrateDeploy(
      uniqueUrls([
        process.env.DIRECT_URL,
        toSessionPoolerUrl(databaseUrl),
        databaseUrl,
      ]),
    );
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
