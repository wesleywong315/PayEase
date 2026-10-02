import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/current-user";
import type { MembershipRole, MembershipStatus } from "@/generated/prisma/client";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  const body: ApiErrorBody = { error: { code, message, details } };
  return NextResponse.json(body, { status });
}

export async function requireApiUser() {
  const user = await getSessionUser();
  if (!user) {
    return { error: apiError(401, "UNAUTHORIZED", "Sign in required.") } as const;
  }
  return { user } as const;
}

export async function getActiveMembership(communityId: string, userId: string) {
  return prisma.membership.findFirst({
    where: {
      communityId,
      userId,
      status: "ACTIVE",
    },
  });
}

export async function requireCommunityMember(communityId: string, userId: string) {
  const membership = await getActiveMembership(communityId, userId);
  if (!membership) {
    return {
      error: apiError(403, "FORBIDDEN", "You are not an active member of this community."),
    } as const;
  }
  return { membership } as const;
}

export async function requireCommunityCoordinator(
  communityId: string,
  userId: string,
) {
  const result = await requireCommunityMember(communityId, userId);
  if ("error" in result) return result;
  if (result.membership.role !== "COORDINATOR") {
    return {
      error: apiError(
        403,
        "FORBIDDEN",
        "Only community coordinators can perform this action.",
      ),
    } as const;
  }
  return result;
}

export type MembershipSnapshot = {
  id: string;
  role: MembershipRole;
  status: MembershipStatus;
};
