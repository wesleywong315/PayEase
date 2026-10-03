import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenCycle } from "@/lib/community";
import { mapDomainError } from "@/server/auth/map-domain-error";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import { recordPayAidFunding } from "@/server/services/payaid";

type RouteCtx = { params: Promise<{ communityId: string }> };

const schema = z.object({
  amountCents: z.number().int().positive(),
  kind: z.enum(["RECEIVED", "PLEDGED"]),
  note: z.string().nullable().optional(),
  idempotencyKey: z.string().min(8).max(120),
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
    return apiError(400, "VALIDATION_ERROR", "Invalid funding payload.");
  }

  try {
    const funding = await recordPayAidFunding({
      communityId,
      cycleId: cycle.id,
      actorMembershipId: coord.membership.id,
      ...parsed.data,
    });
    return NextResponse.json({ funding }, { status: 201 });
  } catch (err) {
    return mapDomainError(err);
  }
}
