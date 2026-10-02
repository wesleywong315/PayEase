import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import { DomainError } from "@/server/services/communities";
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
    .object({ cycleRevision: z.number().int().positive() })
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
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DomainError) {
      const status =
        err.code === "NOT_FOUND"
          ? 404
          : err.code === "STALE_REVISION" || err.code === "CONFLICT"
            ? 409
            : err.code === "BUDGET_CAP_EXCEEDED" || err.code === "PRECONDITION_FAILED"
              ? 422
              : 400;
      return apiError(status, err.code, err.message, err.details);
    }
    console.error(err);
    return apiError(500, "INTERNAL", "Unexpected server error.");
  }
}
