import Link from "next/link";
import { CreateCycleForm } from "@/components/CreateCycleForm";
import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { StatGrid } from "@/components/StatGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

function treasurerCashApprox(
  txs: { type: string; amountCents: number }[],
): number {
  let total = 0;
  for (const tx of txs) {
    if (
      tx.type === "HARDSHIP_FUNDING_RECEIPT" ||
      tx.type === "MEMBER_CONTRIBUTION"
    ) {
      total += tx.amountCents;
    } else if (
      tx.type === "PAYER_REIMBURSEMENT" ||
      tx.type === "MEMBER_REFUND"
    ) {
      total -= tx.amountCents;
    }
  }
  return total;
}

export default async function CommunityDashboardPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const openCycle = await getOpenCycle(communityId);
  const user = await getSessionUser();
  const membership = user
    ? await getActiveMembership(communityId, user.id)
    : null;
  const isCoordinator = membership?.role === "COORDINATOR";

  if (!openCycle) {
    return (
      <div className="space-y-6">
        <PageHeader
          showBack={false}
          eyebrow={community.name}
          title="Dashboard"
          description="No open financial cycle for this community."
        />
        {isCoordinator ? (
          <>
            <CreateCycleForm communityId={communityId} />
            <Link
              href={`/communities/${communityId}/invitations`}
              className="focus-ring inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              Share invitation
            </Link>
          </>
        ) : (
          <EmptyState
            title="No open cycle"
            description="Ask a coordinator to open a financial cycle before expenses can be tracked."
          />
        )}
      </div>
    );
  }

  const [
    committedAgg,
    hardshipFundingAgg,
    hardshipAppliedAgg,
    cashTxs,
    pendingCapCount,
    members,
    expenses,
  ] = await Promise.all([
    prisma.expense.aggregate({
      where: {
        communityId,
        cycleId: openCycle.id,
        status: "COMMITTED",
      },
      _sum: { totalCents: true },
    }),
    prisma.hardshipFunding.aggregate({
      where: {
        cycleId: openCycle.id,
        kind: "RECEIVED",
      },
      _sum: { amountCents: true },
    }),
    prisma.allocation.aggregate({
      where: {
        expense: {
          communityId,
          cycleId: openCycle.id,
          status: "COMMITTED",
        },
      },
      _sum: { hardshipAppliedCents: true },
    }),
    prisma.cashTransaction.findMany({
      where: { cycleId: openCycle.id },
      select: { type: true, amountCents: true },
    }),
    prisma.contributionCapRequest.count({
      where: {
        cycleId: openCycle.id,
        status: "PENDING",
      },
    }),
    prisma.membership.findMany({
      where: { communityId, status: "ACTIVE" },
      include: {
        user: { select: { displayName: true, email: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.expense.findMany({
      where: { communityId, cycleId: openCycle.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        totalCents: true,
      },
    }),
  ]);

  const totalCommitted = committedAgg._sum.totalCents ?? 0;
  const hardshipReceived = hardshipFundingAgg._sum.amountCents ?? 0;
  const hardshipApplied = hardshipAppliedAgg._sum.hardshipAppliedCents ?? 0;
  const cashApprox = treasurerCashApprox(cashTxs);

  return (
    <div className="space-y-10">
      <PageHeader
        showBack={false}
        eyebrow={openCycle.name}
        title="Dashboard"
        description={
          community.description?.trim()
            ? community.description
            : `Overview for ${community.name}.`
        }
        actions={
          isCoordinator ? (
            <Link
              href={`/communities/${communityId}/invitations`}
              className="focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink"
            >
              Share invitation
            </Link>
          ) : null
        }
      />

      <StatGrid
        items={[
          {
            label: "Total committed expenses",
            value: <MoneyText cents={totalCommitted} label="Total committed" />,
          },
          {
            label: "Hardship funding received",
            value: (
              <MoneyText cents={hardshipReceived} label="Hardship funding received" />
            ),
          },
          {
            label: "Hardship support applied",
            value: (
              <MoneyText cents={hardshipApplied} label="Hardship support applied" />
            ),
          },
          {
            label: "Treasurer cash (approx)",
            value: <MoneyText cents={cashApprox} label="Treasurer cash approximate" />,
            hint: "Receipts + contributions − reimbursements − refunds",
          },
          {
            label: "Pending cap requests",
            value: pendingCapCount,
          },
          {
            label: "Active members",
            value: members.length,
          },
        ]}
      />

      <section aria-labelledby="members-heading" className="space-y-4">
        <h2 id="members-heading" className="text-xl font-semibold text-foreground">
          Members
        </h2>
        {members.length === 0 ? (
          <EmptyState title="No active members" />
        ) : (
          <ul className="divide-y divide-border border border-border bg-surface">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {member.user.displayName}
                  </p>
                  <p className="text-sm text-muted">
                    {member.user.email ?? "No email"}
                  </p>
                </div>
                <StatusBadge status={member.role} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="expenses-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="expenses-heading" className="text-xl font-semibold text-foreground">
            Expenses
          </h2>
          <Link
            href={`/communities/${communityId}/expenses`}
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            View all
          </Link>
        </div>
        {expenses.length === 0 ? (
          <EmptyState
            title="No expenses in this cycle"
            description="Committed and draft expenses will appear here."
          />
        ) : (
          <ul className="divide-y divide-border border border-border bg-surface">
            {expenses.map((expense) => (
              <li key={expense.id}>
                <Link
                  href={`/communities/${communityId}/expenses/${expense.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-background"
                >
                  <div>
                    <p className="font-medium text-foreground">{expense.title}</p>
                    <p className="text-sm text-muted">{expense.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <MoneyText cents={expense.totalCents} />
                    <StatusBadge status={expense.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
