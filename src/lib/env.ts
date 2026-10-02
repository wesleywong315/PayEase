import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL must not be empty")
    .refine((value) => value.trim().length > 0, {
      message: "DATABASE_URL must not be empty",
    }),
  /** Optional for local demo; required in production (Railway). */
  SESSION_SECRET: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export type DatabaseProvider = "sqlite" | "postgresql";

export function parseEnv(
  raw: Record<string, string | undefined> = process.env,
): AppEnv {
  return envSchema.parse({
    DATABASE_URL: raw.DATABASE_URL,
    SESSION_SECRET: raw.SESSION_SECRET,
    DIRECT_URL: raw.DIRECT_URL,
    NODE_ENV: raw.NODE_ENV,
  });
}

export function getDatabaseUrl(
  raw: Record<string, string | undefined> = process.env,
): string {
  return parseEnv(raw).DATABASE_URL;
}

/**
 * Infer Prisma/runtime provider from DATABASE_URL shape.
 * Local default remains SQLite (`file:` / `:memory:`).
 */
export function detectDatabaseProvider(
  databaseUrl: string = getDatabaseUrl(),
): DatabaseProvider {
  const trimmed = databaseUrl.trim().toLowerCase();
  if (
    trimmed.startsWith("postgres://") ||
    trimmed.startsWith("postgresql://")
  ) {
    return "postgresql";
  }
  if (trimmed.startsWith("file:") || trimmed === ":memory:") {
    return "sqlite";
  }
  // Unknown schemes default to sqlite for local safety only when clearly file-like;
  // otherwise treat as postgres-compatible if it looks like a host URL.
  if (trimmed.includes("://")) {
    throw new Error(
      `Unsupported DATABASE_URL scheme. Use file:./prisma/dev.db (local) or postgresql://… (Supabase). Got: ${databaseUrl.slice(0, 32)}…`,
    );
  }
  return "sqlite";
}

/**
 * Session secret for HMAC cookies.
 * Local demo allows a documented fallback; production (Railway) requires ≥16 chars.
 */
export function getSessionSecret(
  raw: Record<string, string | undefined> = process.env,
): string {
  const env = parseEnv(raw);
  const secret = env.SESSION_SECRET?.trim();
  const isProd =
    env.NODE_ENV === "production" || raw.RAILWAY_ENVIRONMENT !== undefined;

  if (secret && secret.length >= 16) {
    return secret;
  }

  if (isProd) {
    throw new Error(
      "SESSION_SECRET must be set to a string of at least 16 characters in production.",
    );
  }

  return "payease-demo-session-secret";
}

export function getDirectUrl(
  raw: Record<string, string | undefined> = process.env,
): string | undefined {
  const value = parseEnv(raw).DIRECT_URL?.trim();
  return value && value.length > 0 ? value : undefined;
}
