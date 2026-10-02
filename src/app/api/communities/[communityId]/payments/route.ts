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
import {
  confirmPaymentSubmission,
  listPendingSubmissions,
  rejectPaymentSubmission,
  submitDemoPayment,
} from "@/server/services/payments";

type RouteCtx = { params: Promise<{ communityId: string }> };

function mapErr(err: unknown) {
  if (err instanceof DomainError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "FORBIDDEN"
          ? 403
          : err.code === "CONFLICT" || err.code === "STALE_BALANCE"
            ? 409
            : err.code === "NOT_IMPLEMENTED"
              ? 501
              : 400;
    return apiError(status, err.code, err.message, err.details);
  }
  console.error(err);
  return apiError(500, "INTERNAL", "Unexpected server error.");
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const { communityId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const coord = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in coord) return coord.error;

  const pending = await listPendingSubmissions(communityId);
  return NextResponse.json({ pending });
}

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

  const body = await req.json().catch(() => null);
  const action = z
    .object({
      action: z.enum(["submit", "confirm", "reject"]),
    })
    .safeParse(body);

  if (!action.success) {
    return apiError(400, "VALIDATION_ERROR", "action is required.");
  }

  try {
    if (action.data.action === "submit") {
      const parsed = z
        .object({
          expenseId: z.string().min(1),
          amountCents: z.number().int().positive(),
          method: z.enum([
            "DEMO_SIMULATE",
            "ALIPAY_PLACEHOLDER",
            "WALLET_PLACEHOLDER",
          ]),
          note: z.string().nullable().optional(),
        })
        .safeParse(body);
      if (!parsed.success) {
        return apiError(400, "VALIDATION_ERROR", "Invalid submit payload.");
      }
      const submission = await submitDemoPayment({
        communityId,
        cycleId: cycle.id,
        membershipId: member.membership.id,
        ...parsed.data,
      });
      return NextResponse.json({ submission }, { status: 201 });
    }

    const coord = await requireCommunityCoordinator(communityId, auth.user.id);
    if ("error" in coord) return coord.error;

    if (action.data.action === "confirm") {
      const parsed = z
        .object({ submissionId: z.string().min(1) })
        .safeParse(body);
      if (!parsed.success) {
        return apiError(400, "VALIDATION_ERROR", "submissionId required.");
      }
      const result = await confirmPaymentSubmission({
        communityId,
        submissionId: parsed.data.submissionId,
        actorMembershipId: coord.membership.id,
      });
      return NextResponse.json(result);
    }

    const parsed = z
      .object({
        submissionId: z.string().min(1),
        reason: z.string().nullable().optional(),
      })
      .safeParse(body);
    if (!parsed.success) {
      return apiError(400, "VALIDATION_ERROR", "submissionId required.");
    }
    const submission = await rejectPaymentSubmission({
      communityId,
      submissionId: parsed.data.submissionId,
      actorMembershipId: coord.membership.id,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ submission });
  } catch (err) {
    return mapErr(err);
  }
}
