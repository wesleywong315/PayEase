import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
  requireCommunityMember,
} from "@/server/auth/permissions";
import { DomainError } from "@/server/services/communities";
import {
  listCommunityUpdates,
  markNotificationRead,
} from "@/server/services/payments";

type RouteCtx = { params: Promise<{ communityId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { communityId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  // Updates feed is coordinator-primary per SPEC; members may read own-related later.
  const coord = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in coord) return coord.error;

  const updates = await listCommunityUpdates(communityId);
  return NextResponse.json({
    updates: updates.map((u) => ({
      ...u,
      readByMe: u.reads.some((r) => r.membershipId === coord.membership.id),
    })),
  });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { communityId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const member = await requireCommunityMember(communityId, auth.user.id);
  if ("error" in member) return member.error;

  const parsed = z
    .object({ notificationId: z.string().min(1) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "notificationId required.");
  }

  try {
    await markNotificationRead({
      communityId,
      notificationId: parsed.data.notificationId,
      membershipId: member.membership.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DomainError) {
      return apiError(err.code === "NOT_FOUND" ? 404 : 400, err.code, err.message);
    }
    console.error(err);
    return apiError(500, "INTERNAL", "Unexpected server error.");
  }
}
