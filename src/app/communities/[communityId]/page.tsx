import Link from "next/link";
import {
  CoordinatorFinanceChart,
  type FinanceBarSeries,
} from "@/components/CoordinatorFinanceChart";
import { CoordinatorReceivablesPanel } from "@/components/CoordinatorReceivablesPanel";
import { CreateCycleForm } from "@/components/CreateCycleForm";
import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";
import { getTreasurerCashCents } from "@/server/services/ledger";
import { getCoordinatorReceivables } from "@/server/services/receivables";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

const CASH_IN = new Set([
  "HARDSHIP_FUNDING_RECEIPT",
  "CREDIT_RECEIPT",
  "MEMBER_CONTRIBUTION",
]);
const CASH_OUT = new Set(["PAYER_REIMBURSEMENT"]);

const CASH_TYPE_LABEL: Record<string, string> = {
  HARDSHIP_FUNDING_RECEIPT: "PayAid funding in",
  CREDIT_RECEIPT: "Credits / grants",
  MEMBER_CONTRIBUTION: "Member contributions",
  PAYER_REIMBURSEMENT: "Payer reimbursements",
};

function formatCycleWindow(endsAt: Date | string | null | undefined): string {
  if (endsAt == null) return "End date not set";
  const endDate = endsAt instanceof Date ? endsAt : new Date(endsAt);
  if (Number.isNaN(endDate.getTime())) return "End date not set";
  const end = endDate.toISOString().slice(0, 10);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDay = new Date(endDate);
  endDay.setHours(0, 0, 0, 0);
  const ms = endDay.getTime() - today.getTime();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days < 0) return `Ended ${end} (${Math.abs(days)} day(s) ago)`;
  if (days === 0) return `Ends today (${end})`;
  return `Ends ${end} · ${days} day(s) remaining`;
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
      <div className="space-y-5">
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
              href={`/communities/${communityId}/community`}
              className="focus-ring inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              Community tools
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
    committedExpenses,
    hardshipFundingRows,
    creditRows,
    cashTxs,
    expenses,
    receivables,
  ] = await Promise.all([
    prisma.expense.findMany({
      where: {
        communityId,
        cycleId: openCycle.id,
        status: "COMMITTED",
      },
      select: { id: true, title: true, category: true, totalCents: true },
      orderBy: { committedAt: "asc" },
    }),
    prisma.hardshipFunding.findMany({
      where: { cycleId: openCycle.id, kind: "RECEIVED", cashTransactionId: { not: null } },
      select: {
        id: true,
        amountCents: true,
        note: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.credit.findMany({
      where: { communityId, cycleId: openCycle.id },
      select: {
        id: true,
        title: true,
        category: true,
        amountCents: true,
        receivedAt: true,
      },
      orderBy: { receivedAt: "asc" },
    }),
    prisma.cashTransaction.findMany({
      where: { cycleId: openCycle.id },
      select: {
        id: true,
        type: true,
        amountCents: true,
        note: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
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
    isCoordinator
      ? getCoordinatorReceivables({
          communityId,
          cycleId: openCycle.id,
        })
      : Promise.resolve([]),
  ]);

  const totalCommitted = committedExpenses.reduce(
    (sum, e) => sum + e.totalCents,
    0,
  );
  const payAidReceived = hardshipFundingRows.reduce(
    (sum, row) => sum + row.amountCents,
    0,
  );
  const creditsReceived = creditRows.reduce(
    (sum, row) => sum + row.amountCents,
    0,
  );
  const fundingInTotal = payAidReceived + creditsReceived;
  const cashApprox = await getTreasurerCashCents(openCycle.id);

  const cashByType = new Map<string, number>();
  for (const tx of cashTxs) {
    if (!CASH_IN.has(tx.type) && !CASH_OUT.has(tx.type)) continue;
    const signed = CASH_OUT.has(tx.type) ? -tx.amountCents : tx.amountCents;
    cashByType.set(tx.type, (cashByType.get(tx.type) ?? 0) + signed);
  }

  const fundingBreakdown = [
    ...creditRows.map((row) => ({
      id: `credit:${row.id}`,
      label: row.title,
      detail: `${row.category} · ${row.receivedAt.toISOString().slice(0, 10)}`,
      amountCents: row.amountCents,
    })),
    ...hardshipFundingRows.map((row) => ({
      id: `payaid:${row.id}`,
      label: row.note?.trim() || "PayAid contribution",
      detail: `PayAid · ${row.createdAt.toISOString().slice(0, 10)}`,
      amountCents: row.amountCents,
    })),
  ];

  const financeSeries: FinanceBarSeries[] = [
    {
      id: "committed",
      label: "Committed",
      totalCents: totalCommitted,
      color: "#1f5a45",
      breakdown: committedExpenses.map((e) => ({
        id: e.id,
        label: e.title,
        detail: e.category,
        amountCents: e.totalCents,
      })),
    },
    {
      id: "fundingIn",
      label: "Funding in",
      totalCents: fundingInTotal,
      color: "#b88a5a",
      breakdown: fundingBreakdown,
    },
    {
      id: "treasurerCash",
      label: "Cash",
      totalCents: Math.max(0, cashApprox),
      color: "#103b2f",
      breakdown: [...cashByType.entries()].map(([type, amount]) => ({
        id: type,
        label: CASH_TYPE_LABEL[type] ?? type,
        detail: amount < 0 ? "Outflow" : "Inflow",
        amountCents: Math.abs(amount),
      })),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        showBack={false}
        eyebrow={openCycle.name}
        title="Dashboard"
        description={formatCycleWindow(openCycle.endsAt)}
        actions={
          isCoordinator ? (
            <Link
              href={`/communities/${communityId}/community`}
              className="focus-ring rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-ink"
            >
              Community
            </Link>
          ) : null
        }
      />

      {isCoordinator ? (
        <>
          <CoordinatorFinanceChart series={financeSeries} />

          <section aria-labelledby="participants-heading" className="space-y-2">
            <h2
              id="participants-heading"
              className="text-base font-semibold text-ink"
            >
              Participants
            </h2>
            <CoordinatorReceivablesPanel members={receivables} />
          </section>
        </>
      ) : null}

      <section aria-labelledby="expenses-heading" className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="expenses-heading"
            className="text-base font-semibold text-ink"
          >
            Expenses
          </h2>
          <Link
            href={`/communities/${communityId}/finance`}
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            View finance
          </Link>
        </div>
        {expenses.length === 0 ? (
          <EmptyState
            title="No expenses in this cycle"
            description="Committed and draft expenses will appear here."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {expenses.map((expense) => (
              <li key={expense.id}>
                <Link
                  href={`/communities/${communityId}/expenses/${expense.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-canvas/70"
                >
                  <p className="min-w-0 truncate text-sm font-medium text-ink">
                    {expense.title}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <MoneyText
                      cents={expense.totalCents}
                      className="text-sm"
                    />
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
