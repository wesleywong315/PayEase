import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  detectDatabaseProvider,
  getDatabaseUrl,
  type DatabaseProvider,
} from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

/**
 * Resolve SQLite file: URLs against the project working directory so
 * migrations, seed, and the app open the same database file.
 */
export function resolveSqliteUrl(databaseUrl: string): string {
  if (databaseUrl === ":memory:") {
    return databaseUrl;
  }

  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  const filePath = databaseUrl.slice("file:".length);
  if (path.isAbsolute(filePath)) {
    return databaseUrl;
  }

  return `file:${path.resolve(process.cwd(), filePath)}`;
}

export function createPrismaClient(
  databaseUrl: string = getDatabaseUrl(),
): PrismaClient {
  const provider: DatabaseProvider = detectDatabaseProvider(databaseUrl);

  if (provider === "postgresql") {
    const pool =
      globalForPrisma.pgPool ??
      new Pool({
        connectionString: databaseUrl,
        max: 10,
      });
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.pgPool = pool;
    }
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }

  const adapter = new PrismaBetterSqlite3({
    url: resolveSqliteUrl(databaseUrl),
  });
  return new PrismaClient({ adapter });
}

function getCachedPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (
    existing &&
    typeof (existing as { membershipEqualCover?: unknown }).membershipEqualCover !==
      "undefined"
  ) {
    return existing;
  }
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getCachedPrisma();
