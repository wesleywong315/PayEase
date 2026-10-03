/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveSqliteUrl } from "@/lib/db";
import { getDatabaseUrl } from "@/lib/env";
import { DEMO } from "../../prisma/demo-ids";
import {
  confirmPaymentSubmission,
  getMemberPaymentRibbons,
  submitTrackedPayment,
} from "@/server/services/payments";
import { getMembershipBalances } from "@/server/services/balances";
import { getCategoryReportSlices } from "@/server/services/reports";

const adapter = new PrismaBetterSqlite3({
  url: resolveSqliteUrl(getDatabaseUrl()),
});
const prisma = new PrismaClient({ adapter });

describe("payment pending → confirm (integration against seeded DB)", () => {
  beforeAll(async () => {
    // Reset Ben ↔ training fee so full-pay tests can re-run against the seed.
    await prisma.paymentSubmission.deleteMany({
      where: {
        membershipId: DEMO.memberships.ben,
        expenseId: DEMO.trainingExpenseId,
      },
    });
    await prisma.cashTransaction.deleteMany({
      where: {
        membershipId: DEMO.memberships.ben,
        expenseId: DEMO.trainingExpenseId,
        type: "MEMBER_CONTRIBUTION",
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("ribbons use due dates and outstanding amounts", async () => {
    const ribbons = await getMemberPaymentRibbons({
      communityId: DEMO.communityId,
      membershipId: DEMO.memberships.ben,
      now: new Date("2026-10-02T12:00:00.000Z"),
    });
    const training = ribbons.find((r) => r.expenseId === DEMO.trainingExpenseId);
    expect(training).toBeTruthy();
    expect(training!.outstandingCents).toBeGreaterThan(0);
    expect(training!.dueAt).not.toBeNull();
    // 2026-10-05 is within 7 days of 2026-10-02 → DUE_SOON (or OVERDUE if past)
    expect(["DUE_SOON", "OVERDUE"]).toContain(training!.state);
  });

  it("record creates pending only; confirm writes one cash tx", async () => {
    const before = await getMembershipBalances([DEMO.memberships.ben]);
    const outstandingBefore =
      before.get(DEMO.memberships.ben)!.contributionOutstandingCents;
    expect(outstandingBefore).toBeGreaterThan(0);

    const allocation = await prisma.allocation.findUniqueOrThrow({
      where: {
        expenseId_membershipId: {
          expenseId: DEMO.trainingExpenseId,
          membershipId: DEMO.memberships.ben,
        },
      },
    });
    const paidAgg = await prisma.cashTransaction.aggregate({
      where: {
        membershipId: DEMO.memberships.ben,
        expenseId: DEMO.trainingExpenseId,
        type: "MEMBER_CONTRIBUTION",
      },
      _sum: { amountCents: true },
    });
    const remainingOnExpense = Math.max(
      0,
      allocation.finalChargeCents - (paidAgg._sum.amountCents ?? 0),
    );
    expect(remainingOnExpense).toBeGreaterThan(0);

    await expect(
      submitTrackedPayment({
        communityId: DEMO.communityId,
        cycleId: DEMO.cycleId,
        membershipId: DEMO.memberships.ben,
        expenseId: DEMO.trainingExpenseId,
        amountCents: Math.max(1, remainingOnExpense - 1),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const submission = await submitTrackedPayment({
      communityId: DEMO.communityId,
      cycleId: DEMO.cycleId,
      membershipId: DEMO.memberships.ben,
      expenseId: DEMO.trainingExpenseId,
      amountCents: remainingOnExpense,
    });
    expect(submission.status).toBe("PENDING_CONFIRMATION");
    expect(submission.method).toBe("TRACKED");
    expect(submission.cashTransactionId).toBeNull();

    const mid = await getMembershipBalances([DEMO.memberships.ben]);
    expect(mid.get(DEMO.memberships.ben)!.contributionOutstandingCents).toBe(
      outstandingBefore,
    );

    const confirmed = await confirmPaymentSubmission({
      communityId: DEMO.communityId,
      submissionId: submission.id,
      actorMembershipId: DEMO.memberships.alex,
    });
    expect(confirmed.submission.status).toBe("CONFIRMED");
    expect(confirmed.cashTransaction.amountCents).toBe(remainingOnExpense);
    expect(confirmed.cashTransaction.type).toBe("MEMBER_CONTRIBUTION");

    const after = await getMembershipBalances([DEMO.memberships.ben]);
    expect(after.get(DEMO.memberships.ben)!.contributionOutstandingCents).toBe(
      outstandingBefore - remainingOnExpense,
    );

    await expect(
      confirmPaymentSubmission({
        communityId: DEMO.communityId,
        submissionId: submission.id,
        actorMembershipId: DEMO.memberships.alex,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("category report aggregates committed expenses", async () => {
    const slices = await getCategoryReportSlices({
      communityId: DEMO.communityId,
      cycleId: DEMO.cycleId,
    });
    expect(slices.some((s) => s.label === "Training")).toBe(true);
    const training = slices.find((s) => s.label === "Training");
    expect(training!.totalCents).toBeGreaterThanOrEqual(DEMO.trainingTotalCents);
  });
});
