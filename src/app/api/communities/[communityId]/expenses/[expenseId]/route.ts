import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import { DomainError } from "@/server/services/communities";
import { updateDraftExpense } from "@/server/services/expenses";

type RouteCtx = {
  params: Promise<{ communityId: string; expenseId: string }>;
};

const participantSchema = z.object({
  membershipId: z.string().min(1),
  usageUnits: z.number().int().nonnegative(),
});

const draftSchema = z.object({
  title: z.string(),
  categoryId: z.string().nullable(),
  categoryLabel: z.string().default(""),
  isOneTimeCategory: z.boolean().default(false),
  fixedCents: z.number().int().nonnegative(),
  variableCents: z.number().int().nonnegative(),
  usageLabel: z.string(),
  dueAt: z.string().datetime(),
  frontedByMembershipId: z.string().nullable(),
  participants: z.array(participantSchema).min(1),
  cycleRevision: z.number().int().positive(),
});

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { communityId, expenseId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const coord = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in coord) return coord.error;

  const parsed = draftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid expense payload.", {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  try {
    const expense = await updateDraftExpense({
      communityId,
      expenseId,
      actorMembershipId: coord.membership.id,
      title: data.title,
      categoryId: data.categoryId,
      categoryLabel: data.categoryLabel,
      isOneTimeCategory: data.isOneTimeCategory || !data.categoryId,
      fixedCents: data.fixedCents,
      variableCents: data.variableCents,
      usageLabel: data.usageLabel,
      dueAt: new Date(data.dueAt),
      frontedByMembershipId: data.frontedByMembershipId,
      participants: data.participants,
      cycleRevision: data.cycleRevision,
    });
    return NextResponse.json({ expense });
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
