import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseUrl } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
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

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: resolveSqliteUrl(getDatabaseUrl()),
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
