import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenCycle } from "@/lib/community";
import { mapDomainError } from "@/server/auth/map-domain-error";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import {
  recordCoordinatorContribution,
  recordPayerReimbursement,
} from "@/server/services/cash";

type RouteCtx = { params: Promise<{ communityId: string }> };

const schema = z.object({
  type: z.enum(["PAYER_REIMBURSEMENT", "MEMBER_CONTRIBUTION"]),
  membershipId: z.string().min(1),
  amountCents: z.number().int().positive(),
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
    return apiError(400, "VALIDATION_ERROR", "Invalid cash payload.");
  }

  try {
    const common = {
      communityId,
      cycleId: cycle.id,
      actorMembershipId: coord.membership.id,
      membershipId: parsed.data.membershipId,
      amountCents: parsed.data.amountCents,
      note: parsed.data.note,
      idempotencyKey: parsed.data.idempotencyKey,
    };
    const tx =
      parsed.data.type === "PAYER_REIMBURSEMENT"
        ? await recordPayerReimbursement(common)
        : await recordCoordinatorContribution(common);
    return NextResponse.json({ cashTransaction: tx }, { status: 201 });
  } catch (err) {
    return mapDomainError(err);
  }
}
