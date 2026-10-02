import { describe, expect, it } from "vitest";
import {
  detectDatabaseProvider,
  getSessionSecret,
  parseEnv,
} from "@/lib/env";

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

describe("detectDatabaseProvider", () => {
  it("detects sqlite file URLs", () => {
    expect(detectDatabaseProvider("file:./prisma/dev.db")).toBe("sqlite");
    expect(detectDatabaseProvider(":memory:")).toBe("sqlite");
  });

  it("detects postgresql URLs", () => {
    expect(
      detectDatabaseProvider("postgresql://user:pass@host:5432/db"),
    ).toBe("postgresql");
    expect(detectDatabaseProvider("postgres://user:pass@host:6543/db")).toBe(
      "postgresql",
    );
  });

  it("rejects unsupported schemes", () => {
    expect(() => detectDatabaseProvider("mysql://localhost/db")).toThrow(
      /Unsupported DATABASE_URL/,
    );
  });
});

describe("getSessionSecret", () => {
  it("falls back in non-production when unset", () => {
    expect(
      getSessionSecret({ DATABASE_URL: "file:./x.db", NODE_ENV: "development" }),
    ).toBe("payease-demo-session-secret");
  });

  it("requires SESSION_SECRET in production", () => {
    expect(() =>
      getSessionSecret({
        DATABASE_URL: "postgresql://x",
        NODE_ENV: "production",
      }),
    ).toThrow(/SESSION_SECRET/);
  });

  it("accepts a long SESSION_SECRET", () => {
    expect(
      getSessionSecret({
        DATABASE_URL: "file:./x.db",
        SESSION_SECRET: "payease-local-dev-session-secret",
      }),
    ).toBe("payease-local-dev-session-secret");
  });
});
