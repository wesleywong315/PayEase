import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import { DomainError } from "@/server/services/communities";
import {
  DEFAULT_FEATURE_TOGGLES,
  proposeAndAcceptRuleVersion,
} from "@/server/services/expenses";
import { getOpenCycle } from "@/lib/community";

type RouteCtx = { params: Promise<{ communityId: string }> };

const schema = z.object({
  title: z.string(),
  bodyMarkdown: z.string(),
  equalShareFallbackWhenZeroUsage: z.boolean().default(true),
  featureToggles: z
    .object({
      hardshipEnabled: z.boolean(),
      withdrawalsEnabled: z.boolean(),
      contributionsEnabled: z.boolean(),
    })
    .default(DEFAULT_FEATURE_TOGGLES),
  cycleBudgetCapCents: z.number().int().nonnegative().nullable(),
});

export async function POST(req: Request, ctx: RouteCtx) {
  const { communityId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const coord = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in coord) return coord.error;

  const cycle = await getOpenCycle(communityId);
  if (!cycle) {
    return apiError(422, "PRECONDITION_FAILED", "Open cycle required.");
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid rule payload.", {
      issues: parsed.error.issues,
    });
  }

  try {
    const rule = await proposeAndAcceptRuleVersion({
      communityId,
      cycleId: cycle.id,
      actorMembershipId: coord.membership.id,
      ...parsed.data,
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return apiError(400, err.code, err.message, err.details);
    }
    console.error(err);
    return apiError(500, "INTERNAL", "Unexpected server error.");
  }
}
