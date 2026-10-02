import { describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "@/lib/demo-auth";
import {
  hashPassword,
  normalizeUsername,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "@/lib/password";

describe("password helpers", () => {
  it("hashes and verifies", () => {
    const stored = hashPassword(DEMO_PASSWORD);
    expect(verifyPassword(DEMO_PASSWORD, stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("normalizes and validates usernames", () => {
    expect(normalizeUsername(" Alex ")).toBe("alex");
    expect(validateUsername("ab")).toMatch(/3–32/);
    expect(validateUsername("alex")).toBeNull();
    expect(validateUsername("Bad Name")).toMatch(/letters/);
  });

  it("validates passwords", () => {
    expect(validatePassword("abc")).toMatch(/4–128/);
    expect(validatePassword(DEMO_PASSWORD)).toBeNull();
  });
});
