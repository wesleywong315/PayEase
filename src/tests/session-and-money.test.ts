import { describe, expect, it } from "vitest";
import { formatHkdFromCents, formatHkdFromCentsSigned } from "@/lib/money";
import {
  createSessionToken,
  safeNextPath,
  verifySessionToken,
} from "@/lib/session-token";

describe("money formatting", () => {
  it("formats with thousands separators", () => {
    expect(formatHkdFromCents(120000)).toBe("HK$1,200.00");
    expect(formatHkdFromCents(42000)).toBe("HK$420.00");
    expect(formatHkdFromCents(0)).toBe("HK$0.00");
  });

  it("formats signed values", () => {
    expect(formatHkdFromCentsSigned(-150)).toBe("-HK$1.50");
  });
});

describe("demo session tokens", () => {
  it("round-trips a valid user id", async () => {
    const token = await createSessionToken("user_alex");
    const payload = await verifySessionToken(token);
    expect(payload?.userId).toBe("user_alex");
  });

  it("rejects tampered tokens", async () => {
    const token = await createSessionToken("user_alex");
    const tampered = `${token.slice(0, -4)}xxxx`;
    expect(await verifySessionToken(tampered)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("allows relative destinations and rejects open redirects", () => {
    expect(safeNextPath("/communities")).toBe("/communities");
    expect(safeNextPath("/join/abc")).toBe("/join/abc");
    expect(safeNextPath("https://evil.test")).toBe("/communities");
    expect(safeNextPath("//evil.test")).toBe("/communities");
    expect(safeNextPath(null)).toBe("/communities");
  });
});
