import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenCycle } from "@/lib/community";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
  requireCommunityMember,
} from "@/server/auth/permissions";
import { DomainError } from "@/server/services/communities";
import { createCredit, listCredits } from "@/server/services/credits";

type RouteCtx = { params: Promise<{ communityId: string }> };

function mapDomainError(err: unknown) {
  if (err instanceof DomainError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "IDEMPOTENCY_CONFLICT" || err.code === "CONFLICT"
          ? 409
          : 400;
    return apiError(status, err.code, err.message, err.details);
  }
  console.error(err);
  return apiError(500, "INTERNAL", "Unexpected server error.");
}

const createSchema = z.object({
  title: z.string(),
  categoryId: z.string().nullable().optional(),
  categoryLabel: z.string().optional().default(""),
  isOneTimeCategory: z.boolean(),
  amountCents: z.number().int().positive(),
  note: z.string().nullable().optional(),
  receivedAt: z.string().optional(),
  idempotencyKey: z.string().min(8).max(120),
});

export async function GET(_req: Request, ctx: RouteCtx) {
  const { communityId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const member = await requireCommunityMember(communityId, auth.user.id);
  if ("error" in member) return member.error;

  const openCycle = await getOpenCycle(communityId);
  if (!openCycle) {
    return NextResponse.json({ credits: [] });
  }

  const credits = await listCredits({
    communityId,
    cycleId: openCycle.id,
  });
  return NextResponse.json({ credits });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { communityId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const coord = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in coord) return coord.error;

  const openCycle = await getOpenCycle(communityId);
  if (!openCycle) {
    return apiError(400, "PRECONDITION_FAILED", "No open cycle.");
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid credit payload.");
  }

  const receivedAt = parsed.data.receivedAt
    ? new Date(parsed.data.receivedAt)
    : undefined;
  if (receivedAt && Number.isNaN(receivedAt.getTime())) {
    return apiError(400, "VALIDATION_ERROR", "Invalid received date.");
  }

  try {
    const credit = await createCredit({
      communityId,
      cycleId: openCycle.id,
      actorMembershipId: coord.membership.id,
      title: parsed.data.title,
      categoryId: parsed.data.categoryId ?? null,
      categoryLabel: parsed.data.categoryLabel,
      isOneTimeCategory: parsed.data.isOneTimeCategory,
      amountCents: parsed.data.amountCents,
      note: parsed.data.note,
      receivedAt,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return NextResponse.json({ credit }, { status: 201 });
  } catch (err) {
    return mapDomainError(err);
  }
}
