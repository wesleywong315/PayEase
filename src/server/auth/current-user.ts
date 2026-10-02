import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  createSessionToken,
  safeNextPath,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/session-token";

export { safeNextPath, SESSION_COOKIE };

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      displayName: true,
      email: true,
      createdAt: true,
    },
  });

  return user;
}

export async function requireSessionUser(nextPath?: string) {
  const user = await getSessionUser();
  if (!user) {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${next}`);
  }
  return user;
}

export async function setSessionUser(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(userId), sessionCookieOptions());
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}
