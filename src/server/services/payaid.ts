import { prisma } from "@/lib/db";
import { DomainError } from "@/server/services/communities";
import { requireFeatureEnabled, requireOpenCycle } from "@/server/services/ledger";

export type CapBreach = {
  membershipId: string;
  requestedCapCents: number;
  projectedBaselineCents: number;
  existingAwardsCents: number;
  projectedNetCents: number;
};

export async function recordPayAidFunding(input: {
  communityId: string;
  cycleId: string;
  actorMembershipId: string;
  amountCents: number;
  kind: "RECEIVED" | "PLEDGED";
  note?: string | null;
  idempotencyKey: string;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new DomainError("VALIDATION_ERROR", "Amount must be a positive integer (cents).");
  }
  const key = input.idempotencyKey.trim();
  if (key.length < 8) {
    throw new DomainError("VALIDATION_ERROR", "Idempotency key must be at least 8 characters.");
  }

  await requireOpenCycle({ communityId: input.communityId, cycleId: input.cycleId });
  await requireFeatureEnabled(
    input.cycleId,
    "hardshipEnabled",
    "PayAid is disabled for the accepted rule.",
  );

  return prisma.$transaction(async (tx) => {
    const existingCash = await tx.cashTransaction.findUnique({
      where: {
        cycleId_idempotencyKey: {
          cycleId: input.cycleId,
          idempotencyKey: key,
        },
      },
    });
    if (existingCash) {
      throw new DomainError("IDEMPOTENCY_CONFLICT", "This funding receipt was already recorded.");
    }

    let cashId: string | null = null;
    if (input.kind === "RECEIVED") {
      const cash = await tx.cashTransaction.create({
        data: {
          cycleId: input.cycleId,
          type: "HARDSHIP_FUNDING_RECEIPT",
          amountCents: input.amountCents,
          idempotencyKey: key,
          note: input.note?.trim() || "PayAid funding received",
          manuallyConfirmed: true,
          recordedByMembershipId: input.actorMembershipId,
        },
      });
      cashId = cash.id;
    }

    const funding = await tx.hardshipFunding.create({
      data: {
        cycleId: input.cycleId,
        kind: input.kind,
        amountCents: input.amountCents,
        note: input.note?.trim() || null,
        recordedByMembershipId: input.actorMembershipId,
        cashTransactionId: cashId,
      },
    });

    await tx.financialCycle.update({
      where: { id: input.cycleId },
      data: { revision: { increment: 1 } },
    });

    await tx.auditEvent.create({
      data: {
        communityId: input.communityId,
        cycleId: input.cycleId,
        actorMembershipId: input.actorMembershipId,
        action: "PAYAID_FUNDING_RECORDED",
        entityType: "HardshipFunding",
        entityId: funding.id,
        payloadJson: JSON.stringify({
          kind: input.kind,
          amountCents: input.amountCents,
        }),
      },
    });

    return funding;
  });
}

export async function submitContributionCapRequest(input: {
  communityId: string;
  cycleId: string;
  membershipId: string;
  requestedCapCents: number;
  explanation: string;
}) {
  if (!Number.isInteger(input.requestedCapCents) || input.requestedCapCents < 0) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Requested cap must be a non-negative integer (cents).",
    );
  }
  const explanation = input.explanation.trim();
  if (explanation.length < 8) {
    throw new DomainError("VALIDATION_ERROR", "Explain the request in at least 8 characters.");
  }

  await requireOpenCycle({ communityId: input.communityId, cycleId: input.cycleId });
  await requireFeatureEnabled(
    input.cycleId,
    "hardshipEnabled",
    "PayAid is disabled for the accepted rule.",
  );

  const duplicate = await prisma.contributionCapRequest.findFirst({
    where: {
      cycleId: input.cycleId,
      membershipId: input.membershipId,
      status: "PENDING",
    },
  });
  if (duplicate) {
    throw new DomainError(
      "DUPLICATE_PENDING_REQUEST",
      "You already have a pending contribution-cap request.",
    );
  }

  const request = await prisma.contributionCapRequest.create({
    data: {
      cycleId: input.cycleId,
      membershipId: input.membershipId,
      requestedCapCents: input.requestedCapCents,
      explanation,
    },
  });

  await prisma.financialCycle.update({
    where: { id: input.cycleId },
    data: { revision: { increment: 1 } },
  });

  return request;
}

export async function decideContributionCapRequest(input: {
  communityId: string;
  requestId: string;
  actorMembershipId: string;
  decision: "APPROVE" | "REJECT";
  rejectionReason?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.contributionCapRequest.findUnique({
      where: { id: input.requestId },
      include: { cycle: true, hardshipAward: true },
    });
    if (!request || request.cycle.communityId !== input.communityId) {
      throw new DomainError("NOT_FOUND", "Cap request not found.");
    }
    if (request.cycle.status !== "OPEN") {
      throw new DomainError("CYCLE_CLOSED", "This cycle is closed and read-only.");
    }
    if (request.status !== "PENDING") {
      throw new DomainError("ALREADY_DECIDED", "This request has already been decided.");
    }

    await requireFeatureEnabled(
      request.cycleId,
      "hardshipEnabled",
      "PayAid is disabled for the accepted rule.",
    );

    const now = new Date();
    if (input.decision === "REJECT") {
      const updated = await tx.contributionCapRequest.update({
        where: { id: request.id },
        data: {
          status: "REJECTED",
          decidedAt: now,
          decidedByMembershipId: input.actorMembershipId,
          rejectionReason: input.rejectionReason?.trim() || null,
        },
      });
      await tx.financialCycle.update({
        where: { id: request.cycleId },
        data: { revision: { increment: 1 } },
      });
      return { request: updated, award: null };
    }

    const baselines = await tx.allocation.aggregate({
      where: {
        membershipId: request.membershipId,
        expense: { cycleId: request.cycleId, status: "COMMITTED" },
      },
      _sum: { baselineCents: true },
    });
    const committedBaselines = baselines._sum.baselineCents ?? 0;
    const existingAwards = await tx.hardshipAward.aggregate({
      where: { cycleId: request.cycleId, membershipId: request.membershipId },
      _sum: { amountCents: true },
    });
    const existingAwardsCents = existingAwards._sum.amountCents ?? 0;
    const supportRequired = Math.max(
      0,
      committedBaselines - request.requestedCapCents - existingAwardsCents,
    );

    const received = await tx.hardshipFunding.aggregate({
      where: { cycleId: request.cycleId, kind: "RECEIVED" },
      _sum: { amountCents: true },
    });
    const awarded = await tx.hardshipAward.aggregate({
      where: { cycleId: request.cycleId },
      _sum: { amountCents: true },
    });
    const available = (received._sum.amountCents ?? 0) - (awarded._sum.amountCents ?? 0);

    if (supportRequired > available) {
      throw new DomainError(
        "INSUFFICIENT_HARDSHIP_FUNDING",
        "Available PayAid funding is insufficient for this award.",
        {
          supportRequiredCents: supportRequired,
          availableSupportBudgetCents: available,
          shortfallCents: supportRequired - available,
        },
      );
    }

    const updated = await tx.contributionCapRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        decidedAt: now,
        decidedByMembershipId: input.actorMembershipId,
      },
    });

    let award = null;
    if (supportRequired > 0) {
      award = await tx.hardshipAward.create({
        data: {
          capRequestId: request.id,
          cycleId: request.cycleId,
          membershipId: request.membershipId,
          amountCents: supportRequired,
          approvedByMembershipId: input.actorMembershipId,
        },
      });

      const allocations = await tx.allocation.findMany({
        where: {
          membershipId: request.membershipId,
          expense: { cycleId: request.cycleId, status: "COMMITTED" },
        },
        include: { expense: { select: { committedAt: true, id: true } } },
      });
      allocations.sort((a, b) => {
        const da = a.expense.committedAt?.getTime() ?? 0;
        const db = b.expense.committedAt?.getTime() ?? 0;
        if (da !== db) return da - db;
        return a.expense.id.localeCompare(b.expense.id);
      });

      let remaining = supportRequired;
      for (const row of allocations) {
        if (remaining <= 0) break;
        const room = row.finalChargeCents;
        if (room <= 0) continue;
        const apply = Math.min(remaining, room);
        const hardshipAppliedCents = row.hardshipAppliedCents + apply;
        const finalChargeCents = row.baselineCents - hardshipAppliedCents;
        if (finalChargeCents < 0) {
          throw new DomainError("CONFLICT", "Award would drive a final charge negative.");
        }
        await tx.allocation.update({
          where: { id: row.id },
          data: { hardshipAppliedCents, finalChargeCents },
        });
        remaining -= apply;
      }
    }

    await tx.financialCycle.update({
      where: { id: request.cycleId },
      data: { revision: { increment: 1 } },
    });

    await tx.auditEvent.create({
      data: {
        communityId: input.communityId,
        cycleId: request.cycleId,
        actorMembershipId: input.actorMembershipId,
        action: "PAYAID_CAP_APPROVED",
        entityType: "ContributionCapRequest",
        entityId: request.id,
        payloadJson: JSON.stringify({
          supportRequiredCents: supportRequired,
          awardId: award?.id ?? null,
        }),
      },
    });

    return { request: updated, award };
  });
}

export async function findProjectedCapBreaches(input: {
  cycleId: string;
  additionalBaselines: Array<{ membershipId: string; baselineCents: number }>;
}): Promise<CapBreach[]> {
  const caps = await prisma.contributionCapRequest.findMany({
    where: {
      cycleId: input.cycleId,
      status: { in: ["PENDING", "APPROVED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  const latestByMember = new Map<string, (typeof caps)[number]>();
  for (const cap of caps) {
    if (!latestByMember.has(cap.membershipId)) {
      latestByMember.set(cap.membershipId, cap);
    }
  }
  if (latestByMember.size === 0) return [];

  const existing = await prisma.allocation.groupBy({
    by: ["membershipId"],
    where: {
      membershipId: { in: [...latestByMember.keys()] },
      expense: { cycleId: input.cycleId, status: "COMMITTED" },
    },
    _sum: { baselineCents: true },
  });
  const existingMap = new Map(
    existing.map((row) => [row.membershipId, row._sum.baselineCents ?? 0]),
  );

  const awards = await prisma.hardshipAward.groupBy({
    by: ["membershipId"],
    where: {
      cycleId: input.cycleId,
      membershipId: { in: [...latestByMember.keys()] },
    },
    _sum: { amountCents: true },
  });
  const awardMap = new Map(
    awards.map((row) => [row.membershipId, row._sum.amountCents ?? 0]),
  );

  const addMap = new Map<string, number>();
  for (const line of input.additionalBaselines) {
    addMap.set(line.membershipId, (addMap.get(line.membershipId) ?? 0) + line.baselineCents);
  }

  const breaches: CapBreach[] = [];
  for (const [membershipId, cap] of latestByMember) {
    const projected =
      (existingMap.get(membershipId) ?? 0) + (addMap.get(membershipId) ?? 0);
    const existingAwardsCents = awardMap.get(membershipId) ?? 0;
    const projectedNet = projected - existingAwardsCents;
    if (projectedNet > cap.requestedCapCents) {
      breaches.push({
        membershipId,
        requestedCapCents: cap.requestedCapCents,
        projectedBaselineCents: projected,
        existingAwardsCents,
        projectedNetCents: projectedNet,
      });
    }
  }
  return breaches;
}
