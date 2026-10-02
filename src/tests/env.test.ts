import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("environment validation", () => {
  it("rejects an empty DATABASE_URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "" })).toThrow(/DATABASE_URL/i);
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/i);
  });

  it("accepts a non-empty DATABASE_URL", () => {
    const env = parseEnv({ DATABASE_URL: "file:./prisma/dev.db" });
    expect(env.DATABASE_URL).toBe("file:./prisma/dev.db");
  });
});
