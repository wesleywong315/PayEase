/**
 * Re-export session token helpers for server auth modules.
 * Prefer importing from `@/lib/session-token` in shared/edge code.
 */
export {
  SESSION_COOKIE,
  createSessionToken,
  safeNextPath,
  sessionCookieOptions,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session-token";
