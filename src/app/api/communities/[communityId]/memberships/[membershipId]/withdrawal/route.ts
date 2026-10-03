import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenCycle } from "@/lib/community";
import { mapDomainError } from "@/server/auth/map-domain-error";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
  requireCommunityMember,
} from "@/server/auth/permissions";
import {
  executeWithdrawal,
  previewWithdrawal,
} from "@/server/services/withdrawals";

type RouteCtx = {
  params: Promise<{ communityId: string; membershipId: string }>;
};

export async function POST(req: Request, ctx: RouteCtx) {
  const { communityId, membershipId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const member = await requireCommunityMember(communityId, auth.user.id);
  if ("error" in member) return member.error;

  const cycle = await getOpenCycle(communityId);
  if (!cycle) {
    return apiError(422, "PRECONDITION_FAILED", "Open cycle required.");
  }

  const body = await req.json().catch(() => null);
  const action = z
    .object({ action: z.enum(["preview", "execute"]) })
    .safeParse(body);
  if (!action.success) {
    return apiError(400, "VALIDATION_ERROR", "action is required.");
  }

  const isSelf = member.membership.id === membershipId;
  const isCoordinator = member.membership.role === "COORDINATOR";
  if (!isSelf && !isCoordinator) {
    return apiError(403, "FORBIDDEN", "You can only preview your own withdrawal.");
  }

  try {
    if (action.data.action === "preview") {
      const preview = await previewWithdrawal({
        communityId,
        cycleId: cycle.id,
        membershipId,
      });
      return NextResponse.json({ preview });
    }

    const coord = await requireCommunityCoordinator(communityId, auth.user.id);
    if ("error" in coord) return coord.error;

    const parsed = z
      .object({ cycleRevision: z.number().int().positive() })
      .safeParse(body);
    if (!parsed.success) {
      return apiError(400, "VALIDATION_ERROR", "cycleRevision is required.");
    }

    const result = await executeWithdrawal({
      communityId,
      cycleId: cycle.id,
      membershipId,
      actorMembershipId: coord.membership.id,
      cycleRevision: parsed.data.cycleRevision,
    });
    return NextResponse.json(result);
  } catch (err) {
    return mapDomainError(err);
  }
}
