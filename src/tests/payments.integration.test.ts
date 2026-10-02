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
  submitDemoPayment,
} from "@/server/services/payments";
import { getMembershipBalances } from "@/server/services/balances";
import { getCategoryReportSlices } from "@/server/services/reports";

const adapter = new PrismaBetterSqlite3({
  url: resolveSqliteUrl(getDatabaseUrl()),
});
const prisma = new PrismaClient({ adapter });

describe("payment pending → confirm (integration against seeded DB)", () => {
  beforeAll(async () => {
    // Ensure no leftover pending from prior runs for Ben/training
    await prisma.paymentSubmission.deleteMany({
      where: {
        membershipId: DEMO.memberships.ben,
        expenseId: DEMO.trainingExpenseId,
        status: "PENDING_CONFIRMATION",
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

  it("simulate creates pending only; confirm writes one cash tx", async () => {
    const before = await getMembershipBalances([DEMO.memberships.ben]);
    const outstandingBefore =
      before.get(DEMO.memberships.ben)!.contributionOutstandingCents;
    expect(outstandingBefore).toBeGreaterThan(0);

    const amount = Math.min(500, outstandingBefore);
    const submission = await submitDemoPayment({
      communityId: DEMO.communityId,
      cycleId: DEMO.cycleId,
      membershipId: DEMO.memberships.ben,
      expenseId: DEMO.trainingExpenseId,
      amountCents: amount,
      method: "DEMO_SIMULATE",
    });
    expect(submission.status).toBe("PENDING_CONFIRMATION");
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
    expect(confirmed.cashTransaction.amountCents).toBe(amount);
    expect(confirmed.cashTransaction.type).toBe("MEMBER_CONTRIBUTION");

    const after = await getMembershipBalances([DEMO.memberships.ben]);
    expect(after.get(DEMO.memberships.ben)!.contributionOutstandingCents).toBe(
      outstandingBefore - amount,
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

  it("placeholder methods are rejected", async () => {
    await expect(
      submitDemoPayment({
        communityId: DEMO.communityId,
        cycleId: DEMO.cycleId,
        membershipId: DEMO.memberships.chloe,
        expenseId: DEMO.trainingExpenseId,
        amountCents: 100,
        method: "ALIPAY_PLACEHOLDER",
      }),
    ).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
  });
});
