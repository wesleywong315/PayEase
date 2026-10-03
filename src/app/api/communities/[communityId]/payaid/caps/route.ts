import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenCycle } from "@/lib/community";
import { mapDomainError } from "@/server/auth/map-domain-error";
import {
  apiError,
  requireApiUser,
  requireCommunityMember,
} from "@/server/auth/permissions";
import { submitContributionCapRequest } from "@/server/services/payaid";

type RouteCtx = { params: Promise<{ communityId: string }> };

const schema = z.object({
  requestedCapCents: z.number().int().nonnegative(),
  explanation: z.string(),
});

export async function POST(req: Request, ctx: RouteCtx) {
  const { communityId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const member = await requireCommunityMember(communityId, auth.user.id);
  if ("error" in member) return member.error;

  const cycle = await getOpenCycle(communityId);
  if (!cycle) {
    return apiError(422, "PRECONDITION_FAILED", "Open cycle required.");
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid cap request.");
  }

  try {
    const request = await submitContributionCapRequest({
      communityId,
      cycleId: cycle.id,
      membershipId: member.membership.id,
      requestedCapCents: parsed.data.requestedCapCents,
      explanation: parsed.data.explanation,
    });
    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    return mapDomainError(err);
  }
}
