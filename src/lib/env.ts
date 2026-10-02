import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL must not be empty")
    .refine((value) => value.trim().length > 0, {
      message: "DATABASE_URL must not be empty",
    }),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(
  raw: Record<string, string | undefined> = process.env,
): AppEnv {
  return envSchema.parse({
    DATABASE_URL: raw.DATABASE_URL,
  });
}

export function getDatabaseUrl(
  raw: Record<string, string | undefined> = process.env,
): string {
  return parseEnv(raw).DATABASE_URL;
}
