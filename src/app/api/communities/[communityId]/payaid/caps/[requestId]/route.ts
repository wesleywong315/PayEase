import { NextResponse } from "next/server";
import { z } from "zod";
import { mapDomainError } from "@/server/auth/map-domain-error";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import { decideContributionCapRequest } from "@/server/services/payaid";

type RouteCtx = {
  params: Promise<{ communityId: string; requestId: string }>;
};

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  rejectionReason: z.string().nullable().optional(),
});

export async function POST(req: Request, ctx: RouteCtx) {
  const { communityId, requestId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const coord = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in coord) return coord.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "decision is required.");
  }

  try {
    const result = await decideContributionCapRequest({
      communityId,
      requestId,
      actorMembershipId: coord.membership.id,
      decision: parsed.data.decision,
      rejectionReason: parsed.data.rejectionReason,
    });
    return NextResponse.json(result);
  } catch (err) {
    return mapDomainError(err);
  }
}
