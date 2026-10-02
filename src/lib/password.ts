import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DEMO_PASSWORD } from "@/lib/demo-auth";

export { DEMO_PASSWORD };

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  const value = normalizeUsername(username);
  if (value.length < 3 || value.length > 32) {
    return "Username must be 3–32 characters.";
  }
  if (!/^[a-z0-9_]+$/.test(value)) {
    return "Username may only use letters, numbers, and underscores.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 4 || password.length > 128) {
    return "Password must be 4–128 characters.";
  }
  return null;
}
