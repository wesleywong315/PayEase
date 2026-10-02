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
  createDraftExpense,
  previewExpenseAllocation,
} from "@/server/services/expenses";
import { prisma } from "@/lib/db";

type RouteCtx = { params: Promise<{ communityId: string }> };

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
  previewOnly: z.boolean().optional(),
});

function mapErr(err: unknown) {
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

export async function GET(_req: Request, ctx: RouteCtx) {
  const { communityId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const member = await requireCommunityMember(communityId, auth.user.id);
  if ("error" in member) return member.error;

  const cycle = await getOpenCycle(communityId);
  if (!cycle) return NextResponse.json({ expenses: [], cycle: null });

  const expenses = await prisma.expense.findMany({
    where: { communityId, cycleId: cycle.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      totalCents: true,
      dueAt: true,
      isOneTimeCategory: true,
    },
  });
  return NextResponse.json({ expenses, cycle });
}

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

  const parsed = draftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid expense payload.", {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  try {
    if (data.previewOnly) {
      const preview = previewExpenseAllocation({
        fixedCents: data.fixedCents,
        variableCents: data.variableCents,
        participants: data.participants,
      });
      const names = await prisma.membership.findMany({
        where: { id: { in: data.participants.map((p) => p.membershipId) } },
        include: { user: { select: { displayName: true } } },
      });
      const nameById = new Map(names.map((m) => [m.id, m.user.displayName]));
      return NextResponse.json({
        preview: {
          ...preview,
          rows: preview.lines.map((line) => ({
            membershipId: line.membershipId,
            name: nameById.get(line.membershipId) ?? line.membershipId,
            fixedCents: line.fixedShareCents,
            usageCents: line.usageShareCents,
            baselineCents: line.baselineCents,
          })),
        },
      });
    }

    const expense = await createDraftExpense({
      communityId,
      cycleId: cycle.id,
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

    return NextResponse.json({ expense }, { status: 201 });
  } catch (err) {
    return mapErr(err);
  }
}
