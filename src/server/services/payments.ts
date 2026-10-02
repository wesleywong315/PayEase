import { DomainError } from "@/server/services/communities";
import { getMembershipBalances } from "@/server/services/balances";
import { prisma } from "@/lib/db";

// Note: this module is imported by Vitest integration tests; keep free of `server-only`.

const DUE_SOON_MS = 7 * 24 * 60 * 60 * 1000;

export type PaymentRibbon = {
  expenseId: string;
  title: string;
  category: string;
  dueAt: Date | null;
  /** Member outstanding attributed to this expense (min of charge remaining, contribution outstanding). */
  outstandingCents: number;
  allocationFinalCents: number;
  paidTowardExpenseCents: number;
  state: "OVERDUE" | "DUE_SOON" | "NO_DUE_DATE" | "SETTLED";
};

export async function getMemberPaymentRibbons(input: {
  communityId: string;
  membershipId: string;
  now?: Date;
}): Promise<PaymentRibbon[]> {
  const now = input.now ?? new Date();
  const soonEnd = new Date(now.getTime() + DUE_SOON_MS);

  const allocations = await prisma.allocation.findMany({
    where: {
      membershipId: input.membershipId,
      expense: {
        communityId: input.communityId,
        status: "COMMITTED",
      },
    },
    include: {
      expense: {
        select: {
          id: true,
          title: true,
          category: true,
          dueAt: true,
          cycleId: true,
        },
      },
    },
  });

  const cashTowardExpense = await prisma.cashTransaction.findMany({
    where: {
      membershipId: input.membershipId,
      type: "MEMBER_CONTRIBUTION",
      expenseId: { in: allocations.map((a) => a.expenseId) },
    },
    select: { expenseId: true, amountCents: true },
  });

  const paidByExpense = new Map<string, number>();
  for (const tx of cashTowardExpense) {
    if (!tx.expenseId) continue;
    paidByExpense.set(
      tx.expenseId,
      (paidByExpense.get(tx.expenseId) ?? 0) + tx.amountCents,
    );
  }

  const balances = await getMembershipBalances([input.membershipId]);
  const contributionOutstanding =
    balances.get(input.membershipId)?.contributionOutstandingCents ?? 0;

  const ribbons: PaymentRibbon[] = [];

  for (const row of allocations) {
    const paid = paidByExpense.get(row.expenseId) ?? 0;
    const remainingOnExpense = Math.max(0, row.finalChargeCents - paid);
    if (remainingOnExpense <= 0) {
      ribbons.push({
        expenseId: row.expense.id,
        title: row.expense.title,
        category: row.expense.category,
        dueAt: row.expense.dueAt,
        outstandingCents: 0,
        allocationFinalCents: row.finalChargeCents,
        paidTowardExpenseCents: paid,
        state: "SETTLED",
      });
      continue;
    }

    // Cap ribbon amount by overall contribution outstanding so confirmed ledger wins.
    const outstandingCents = Math.min(remainingOnExpense, contributionOutstanding || remainingOnExpense);

    let state: PaymentRibbon["state"];
    if (!row.expense.dueAt) {
      state = "NO_DUE_DATE";
    } else if (row.expense.dueAt.getTime() < now.getTime()) {
      state = "OVERDUE";
    } else if (row.expense.dueAt.getTime() <= soonEnd.getTime()) {
      state = "DUE_SOON";
    } else {
      // Outside due-soon window — omit from ribbons
      continue;
    }

    ribbons.push({
      expenseId: row.expense.id,
      title: row.expense.title,
      category: row.expense.category,
      dueAt: row.expense.dueAt,
      outstandingCents,
      allocationFinalCents: row.finalChargeCents,
      paidTowardExpenseCents: paid,
      state,
    });
  }

  const rank = (s: PaymentRibbon["state"]) =>
    s === "OVERDUE" ? 0 : s === "DUE_SOON" ? 1 : s === "NO_DUE_DATE" ? 2 : 3;

  return ribbons
    .filter((r) => r.state !== "SETTLED" && r.outstandingCents > 0)
    .filter((r) => r.state === "OVERDUE" || r.state === "DUE_SOON" || r.state === "NO_DUE_DATE")
    .sort((a, b) => {
      const ra = rank(a.state);
      const rb = rank(b.state);
      if (ra !== rb) return ra - rb;
      const da = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const db = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.expenseId.localeCompare(b.expenseId);
    });
}

export async function submitDemoPayment(input: {
  communityId: string;
  cycleId: string;
  membershipId: string;
  expenseId: string;
  amountCents: number;
  method: "DEMO_SIMULATE" | "ALIPAY_PLACEHOLDER" | "WALLET_PLACEHOLDER";
  note?: string | null;
}) {
  if (input.method !== "DEMO_SIMULATE") {
    throw new DomainError(
      "NOT_IMPLEMENTED",
      "This payment method is coming soon. Use Demo / Simulate payment.",
    );
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new DomainError("VALIDATION_ERROR", "Amount must be a positive integer (cents).");
  }

  const expense = await prisma.expense.findFirst({
    where: {
      id: input.expenseId,
      communityId: input.communityId,
      cycleId: input.cycleId,
      status: "COMMITTED",
    },
  });
  if (!expense) {
    throw new DomainError("NOT_FOUND", "Committed expense not found.");
  }

  const allocation = await prisma.allocation.findUnique({
    where: {
      expenseId_membershipId: {
        expenseId: input.expenseId,
        membershipId: input.membershipId,
      },
    },
  });
  if (!allocation) {
    throw new DomainError("FORBIDDEN", "You are not allocated on this expense.");
  }

  const balances = await getMembershipBalances([input.membershipId]);
  const outstanding =
    balances.get(input.membershipId)?.contributionOutstandingCents ?? 0;
  if (outstanding <= 0) {
    throw new DomainError("VALIDATION_ERROR", "You have no outstanding contribution balance.");
  }
  if (input.amountCents > outstanding) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Amount exceeds your outstanding contribution balance.",
      { outstandingCents: outstanding },
    );
  }

  const pending = await prisma.paymentSubmission.findFirst({
    where: {
      membershipId: input.membershipId,
      expenseId: input.expenseId,
      status: "PENDING_CONFIRMATION",
    },
  });
  if (pending) {
    throw new DomainError(
      "CONFLICT",
      "You already have a pending submission for this expense.",
      { submissionId: pending.id },
    );
  }

  const submission = await prisma.paymentSubmission.create({
    data: {
      cycleId: input.cycleId,
      expenseId: input.expenseId,
      membershipId: input.membershipId,
      amountCents: input.amountCents,
      method: input.method,
      status: "PENDING_CONFIRMATION",
      note: input.note?.trim() || null,
      expectedOutstandingCents: outstanding,
    },
  });

  const member = await prisma.membership.findUniqueOrThrow({
    where: { id: input.membershipId },
    include: { user: { select: { displayName: true } } },
  });

  await prisma.communityNotification.create({
    data: {
      communityId: input.communityId,
      kind: "PAYMENT_SUBMITTED",
      title: "Payment submitted for confirmation",
      body: `${member.user.displayName} submitted HK$${(input.amountCents / 100).toFixed(2)} for “${expense.title}” (demo — not a real payment).`,
      payloadJson: JSON.stringify({
        submissionId: submission.id,
        expenseId: expense.id,
        membershipId: input.membershipId,
        amountCents: input.amountCents,
      }),
    },
  });

  return submission;
}

export async function confirmPaymentSubmission(input: {
  communityId: string;
  submissionId: string;
  actorMembershipId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.paymentSubmission.findUnique({
      where: { id: input.submissionId },
      include: {
        membership: { include: { user: { select: { displayName: true } } } },
        expense: { select: { id: true, title: true, communityId: true } },
        cycle: true,
      },
    });
    if (!submission || submission.expense?.communityId !== input.communityId) {
      throw new DomainError("NOT_FOUND", "Payment submission not found.");
    }
    if (submission.status !== "PENDING_CONFIRMATION") {
      throw new DomainError(
        "CONFLICT",
        "Submission is not pending confirmation.",
        { status: submission.status },
      );
    }
    if (submission.cashTransactionId) {
      throw new DomainError("CONFLICT", "Submission already linked to a cash transaction.");
    }

    const balances = await getMembershipBalances([submission.membershipId]);
    const outstanding =
      balances.get(submission.membershipId)?.contributionOutstandingCents ?? 0;

    if (outstanding !== submission.expectedOutstandingCents) {
      throw new DomainError(
        "STALE_BALANCE",
        "Outstanding balance changed since submission. Ask the member to resubmit.",
        {
          expectedOutstandingCents: submission.expectedOutstandingCents,
          currentOutstandingCents: outstanding,
        },
      );
    }
    if (submission.amountCents > outstanding) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "Submission amount exceeds current outstanding balance.",
      );
    }

    const idempotencyKey = `payment-confirm:${submission.id}`;
    const cash = await tx.cashTransaction.create({
      data: {
        cycleId: submission.cycleId,
        type: "MEMBER_CONTRIBUTION",
        amountCents: submission.amountCents,
        membershipId: submission.membershipId,
        expenseId: submission.expenseId,
        idempotencyKey,
        note: `Confirmed demo payment ${submission.id}`,
        manuallyConfirmed: true,
        recordedByMembershipId: input.actorMembershipId,
      },
    });

    const updated = await tx.paymentSubmission.update({
      where: { id: submission.id },
      data: {
        status: "CONFIRMED",
        decidedAt: new Date(),
        decidedByMembershipId: input.actorMembershipId,
        cashTransactionId: cash.id,
      },
    });

    await tx.financialCycle.update({
      where: { id: submission.cycleId },
      data: { revision: { increment: 1 } },
    });

    await tx.communityNotification.create({
      data: {
        communityId: input.communityId,
        kind: "PAYMENT_CONFIRMED",
        title: "Payment confirmed",
        body: `Confirmed ${submission.membership.user.displayName}'s demo payment of HK$${(submission.amountCents / 100).toFixed(2)}${submission.expense ? ` for “${submission.expense.title}”` : ""}.`,
        payloadJson: JSON.stringify({
          submissionId: submission.id,
          cashTransactionId: cash.id,
          amountCents: submission.amountCents,
        }),
      },
    });

    await tx.auditEvent.create({
      data: {
        communityId: input.communityId,
        cycleId: submission.cycleId,
        actorMembershipId: input.actorMembershipId,
        action: "PAYMENT_CONFIRMED",
        entityType: "PaymentSubmission",
        entityId: submission.id,
        payloadJson: JSON.stringify({
          cashTransactionId: cash.id,
          amountCents: submission.amountCents,
        }),
      },
    });

    return { submission: updated, cashTransaction: cash };
  });
}

export async function rejectPaymentSubmission(input: {
  communityId: string;
  submissionId: string;
  actorMembershipId: string;
  reason?: string | null;
}) {
  const submission = await prisma.paymentSubmission.findUnique({
    where: { id: input.submissionId },
    include: {
      membership: { include: { user: { select: { displayName: true } } } },
      expense: { select: { title: true, communityId: true } },
    },
  });
  if (!submission || submission.expense?.communityId !== input.communityId) {
    throw new DomainError("NOT_FOUND", "Payment submission not found.");
  }
  if (submission.status !== "PENDING_CONFIRMATION") {
    throw new DomainError("CONFLICT", "Submission is not pending.");
  }

  const updated = await prisma.paymentSubmission.update({
    where: { id: submission.id },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedByMembershipId: input.actorMembershipId,
      rejectionReason: input.reason?.trim() || null,
    },
  });

  await prisma.communityNotification.create({
    data: {
      communityId: input.communityId,
      kind: "PAYMENT_REJECTED",
      title: "Payment rejected",
      body: `Rejected ${submission.membership.user.displayName}'s demo payment${submission.expense ? ` for “${submission.expense.title}”` : ""}. Ledger unchanged.`,
      payloadJson: JSON.stringify({ submissionId: submission.id }),
    },
  });

  return updated;
}

export async function listCommunityUpdates(communityId: string) {
  return prisma.communityNotification.findMany({
    where: { communityId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reads: { select: { membershipId: true, readAt: true } },
    },
  });
}

export async function markNotificationRead(input: {
  notificationId: string;
  membershipId: string;
  communityId: string;
}) {
  const note = await prisma.communityNotification.findFirst({
    where: { id: input.notificationId, communityId: input.communityId },
  });
  if (!note) {
    throw new DomainError("NOT_FOUND", "Update not found.");
  }

  await prisma.communityNotificationRead.upsert({
    where: {
      notificationId_membershipId: {
        notificationId: input.notificationId,
        membershipId: input.membershipId,
      },
    },
    update: { readAt: new Date() },
    create: {
      notificationId: input.notificationId,
      membershipId: input.membershipId,
    },
  });
}

export async function listPendingSubmissions(communityId: string) {
  return prisma.paymentSubmission.findMany({
    where: {
      status: "PENDING_CONFIRMATION",
      cycle: { communityId },
    },
    include: {
      membership: { include: { user: { select: { displayName: true } } } },
      expense: { select: { id: true, title: true } },
    },
    orderBy: { submittedAt: "asc" },
  });
}
