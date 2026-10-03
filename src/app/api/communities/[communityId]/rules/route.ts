import { NextResponse } from "next/server";
import { z } from "zod";
import { mapDomainError } from "@/server/auth/map-domain-error";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import {
  DEFAULT_FEATURE_TOGGLES,
  proposeRuleVersion,
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
    const rule = await proposeRuleVersion({
      communityId,
      cycleId: cycle.id,
      actorMembershipId: coord.membership.id,
      ...parsed.data,
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    return mapDomainError(err);
  }
}
