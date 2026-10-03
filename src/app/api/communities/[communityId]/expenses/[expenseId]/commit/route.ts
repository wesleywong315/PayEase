import { NextResponse } from "next/server";
import { z } from "zod";
import { mapDomainError } from "@/server/auth/map-domain-error";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import { commitExpense } from "@/server/services/expenses";

type RouteCtx = {
  params: Promise<{ communityId: string; expenseId: string }>;
};

export async function POST(req: Request, ctx: RouteCtx) {
  const { communityId, expenseId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const coord = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in coord) return coord.error;

  const parsed = z
    .object({
      cycleRevision: z.number().int().positive(),
      acknowledgeProjectedCapBreaches: z.boolean().optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "cycleRevision is required.");
  }

  try {
    const result = await commitExpense({
      communityId,
      expenseId,
      actorMembershipId: coord.membership.id,
      cycleRevision: parsed.data.cycleRevision,
      acknowledgeProjectedCapBreaches: parsed.data.acknowledgeProjectedCapBreaches,
    });
    return NextResponse.json(result);
  } catch (err) {
    return mapDomainError(err);
  }
}
