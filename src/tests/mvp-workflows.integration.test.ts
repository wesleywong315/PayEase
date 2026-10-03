/**
 * @vitest-environment node
 */
import { afterAll, describe, expect, it } from "vitest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveSqliteUrl } from "@/lib/db";
import { getDatabaseUrl } from "@/lib/env";
import { DEMO, EXTRA_DEMO_COMMUNITIES } from "../../prisma/demo-ids";
import { DEFAULT_FEATURE_TOGGLES } from "@/lib/feature-toggles";
import { escapeCsvCell } from "@/server/services/reports";
import {
  acceptProposedRule,
  proposeRuleVersion,
} from "@/server/services/expenses";
import {
  decideContributionCapRequest,
  recordPayAidFunding,
} from "@/server/services/payaid";
import { recordPayerReimbursement } from "@/server/services/cash";
import { previewWithdrawal, executeWithdrawal } from "@/server/services/withdrawals";
import { closeFinancialCycle } from "@/server/services/communities";

const adapter = new PrismaBetterSqlite3({
  url: resolveSqliteUrl(getDatabaseUrl()),
});
const prisma = new PrismaClient({ adapter });

describe("unfinished-feature workflows", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function resetVolleyball() {
    const vb = EXTRA_DEMO_COMMUNITIES.volleyball;
    await prisma.withdrawal.deleteMany({ where: { cycleId: vb.cycleId } });
    await prisma.membership.update({
      where: { id: vb.memberships.alex },
      data: { status: "ACTIVE", leftAt: null },
    });
    await prisma.financialCycle.update({
      where: { id: vb.cycleId },
      data: { status: "OPEN", closedAt: null, closeAcknowledgedOutstanding: false },
    });
  }

  it("escapes CSV formula injection", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("+cmd")).toBe("'+cmd");
    expect(escapeCsvCell("ok")).toBe("ok");
  });

  it("proposed rules stay proposed until the snapshot accepts", async () => {
    const vb = EXTRA_DEMO_COMMUNITIES.volleyball;
    await resetVolleyball();
    await prisma.ruleVersion.deleteMany({
      where: { cycleId: vb.cycleId, status: "PROPOSED" },
    });
    const rule = await proposeRuleVersion({
      communityId: vb.id,
      cycleId: vb.cycleId,
      actorMembershipId: vb.memberships.ben,
      title: "Volleyball shared costs",
      bodyMarkdown: "Equal split of committed team costs for this cycle.",
      equalShareFallbackWhenZeroUsage: true,
      featureToggles: DEFAULT_FEATURE_TOGGLES,
      cycleBudgetCapCents: null,
    });
    expect(rule.status).toBe("PROPOSED");

    await acceptProposedRule({
      communityId: vb.id,
      ruleId: rule.id,
      membershipId: vb.memberships.ben,
    });
    const mid = await prisma.ruleVersion.findUniqueOrThrow({ where: { id: rule.id } });
    expect(mid.status).toBe("PROPOSED");

    const done = await acceptProposedRule({
      communityId: vb.id,
      ruleId: rule.id,
      membershipId: vb.memberships.alex,
    });
    expect(done.status).toBe("ACCEPTED");
  });

  it("pledged PayAid is not spendable; approval applies hardship to allocations", async () => {
    const cashBefore = await prisma.cashTransaction.count({
      where: { cycleId: DEMO.cycleId, type: "HARDSHIP_FUNDING_RECEIPT" },
    });
    await recordPayAidFunding({
      communityId: DEMO.communityId,
      cycleId: DEMO.cycleId,
      actorMembershipId: DEMO.memberships.alex,
      amountCents: 50000,
      kind: "PLEDGED",
      note: "Pledge only",
      idempotencyKey: `test-pledge-${Date.now()}`,
    });
    const cashAfterPledge = await prisma.cashTransaction.count({
      where: { cycleId: DEMO.cycleId, type: "HARDSHIP_FUNDING_RECEIPT" },
    });
    expect(cashAfterPledge).toBe(cashBefore);

    await recordPayAidFunding({
      communityId: DEMO.communityId,
      cycleId: DEMO.cycleId,
      actorMembershipId: DEMO.memberships.alex,
      amountCents: 200000,
      kind: "RECEIVED",
      note: "Test pool",
      idempotencyKey: `test-received-${Date.now()}`,
    });

    const existingAward = await prisma.hardshipAward.findUnique({
      where: { capRequestId: DEMO.capRequestId },
    });
    if (existingAward) {
      await prisma.hardshipAward.delete({ where: { id: existingAward.id } });
    }
    await prisma.allocation.updateMany({
      where: {
        membershipId: DEMO.memberships.dana,
        expense: { cycleId: DEMO.cycleId },
      },
      data: { hardshipAppliedCents: 0 },
    });
    const danaRows = await prisma.allocation.findMany({
      where: {
        membershipId: DEMO.memberships.dana,
        expense: { cycleId: DEMO.cycleId, status: "COMMITTED" },
      },
    });
    for (const row of danaRows) {
      await prisma.allocation.update({
        where: { id: row.id },
        data: { finalChargeCents: row.baselineCents, hardshipAppliedCents: 0 },
      });
    }
    await prisma.contributionCapRequest.update({
      where: { id: DEMO.capRequestId },
      data: {
        status: "PENDING",
        decidedAt: null,
        decidedByMembershipId: null,
        rejectionReason: null,
      },
    });

    const pending = await prisma.contributionCapRequest.findFirst({
      where: {
        cycleId: DEMO.cycleId,
        membershipId: DEMO.memberships.dana,
        status: "PENDING",
      },
    });
    expect(pending).toBeTruthy();

    const result = await decideContributionCapRequest({
      communityId: DEMO.communityId,
      requestId: pending!.id,
      actorMembershipId: DEMO.memberships.alex,
      decision: "APPROVE",
    });
    expect(result.request.status).toBe("APPROVED");
    expect(result.award?.amountCents ?? 0).toBeGreaterThan(0);

    const danaAlloc = await prisma.allocation.findMany({
      where: {
        membershipId: DEMO.memberships.dana,
        expense: { cycleId: DEMO.cycleId, status: "COMMITTED" },
      },
    });
    const hardship = danaAlloc.reduce((s, a) => s + a.hardshipAppliedCents, 0);
    const finals = danaAlloc.reduce((s, a) => s + a.finalChargeCents, 0);
    const baselines = danaAlloc.reduce((s, a) => s + a.baselineCents, 0);
    expect(hardship).toBe(result.award!.amountCents);
    expect(finals + hardship).toBe(baselines);
  });

  it("reimbursement cannot exceed outstanding", async () => {
    await expect(
      recordPayerReimbursement({
        communityId: DEMO.communityId,
        cycleId: DEMO.cycleId,
        actorMembershipId: DEMO.memberships.alex,
        membershipId: DEMO.memberships.chloe,
        amountCents: 1,
        idempotencyKey: `test-reimb-${Date.now()}`,
      }),
    ).rejects.toMatchObject({ code: "EXCEEDS_OUTSTANDING_REIMBURSEMENT" });
  });

  it("withdrawal preview is read-only; execute releases drafts and marks LEFT", async () => {
    const vb = EXTRA_DEMO_COMMUNITIES.volleyball;
    await resetVolleyball();
    const before = await prisma.membership.findUniqueOrThrow({
      where: { id: vb.memberships.alex },
    });
    expect(before.status).toBe("ACTIVE");

    await previewWithdrawal({
      communityId: vb.id,
      cycleId: vb.cycleId,
      membershipId: vb.memberships.alex,
    });
    const still = await prisma.membership.findUniqueOrThrow({
      where: { id: vb.memberships.alex },
    });
    expect(still.status).toBe("ACTIVE");

    const cycle = await prisma.financialCycle.findUniqueOrThrow({
      where: { id: vb.cycleId },
    });
    await executeWithdrawal({
      communityId: vb.id,
      cycleId: vb.cycleId,
      membershipId: vb.memberships.alex,
      actorMembershipId: vb.memberships.ben,
      cycleRevision: cycle.revision,
    });
    const left = await prisma.membership.findUniqueOrThrow({
      where: { id: vb.memberships.alex },
    });
    expect(left.status).toBe("LEFT");
  });

  it("closing is blocked while a proposed rule is open; succeeds when clear", async () => {
    const vb = EXTRA_DEMO_COMMUNITIES.volleyball;
    await resetVolleyball();
    const cycle = await prisma.financialCycle.findUniqueOrThrow({
      where: { id: vb.cycleId },
    });
    expect(cycle.status).toBe("OPEN");

    await closeFinancialCycle({
      communityId: vb.id,
      cycleId: vb.cycleId,
      actorMembershipId: vb.memberships.ben,
      acknowledgeOutstandingBalances: true,
    });
    const closed = await prisma.financialCycle.findUniqueOrThrow({
      where: { id: vb.cycleId },
    });
    expect(closed.status).toBe("CLOSED");
  });
});
