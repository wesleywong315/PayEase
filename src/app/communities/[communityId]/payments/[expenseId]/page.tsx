import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { PaymentMethodPanel } from "@/components/PaymentMethodPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";
import { getMembershipBalances } from "@/server/services/balances";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string; expenseId: string }>;
};

export default async function ExpensePaymentPage({ params }: PageProps) {
  const { communityId, expenseId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const user = await requireSessionUser(
    `/communities/${communityId}/payments/${expenseId}`,
  );
  const membership = await getActiveMembership(communityId, user.id);

  if (!membership) {
    return (
      <div className="space-y-8">
        <PageHeader showBack={false} eyebrow={community.name} title="Payment" />
        <EmptyState title="Members only" />
      </div>
    );
  }

  const expense = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      communityId,
      status: "COMMITTED",
    },
    include: {
      allocations: {
        where: { membershipId: membership.id },
      },
    },
  });

  if (!expense) {
    notFound();
  }

  const allocation = expense.allocations[0] ?? null;
  const openCycle = await getOpenCycle(communityId);

  const paidAgg = await prisma.cashTransaction.aggregate({
    where: {
      membershipId: membership.id,
      expenseId: expense.id,
      type: "MEMBER_CONTRIBUTION",
    },
    _sum: { amountCents: true },
  });
  const paidToward = paidAgg._sum.amountCents ?? 0;
  const charge = allocation?.finalChargeCents ?? 0;
  const remainingOnExpense = Math.max(0, charge - paidToward);

  const balances = await getMembershipBalances([membership.id]);
  const outstanding =
    balances.get(membership.id)?.contributionOutstandingCents ?? 0;

  const submissions = await prisma.paymentSubmission.findMany({
    where: {
      membershipId: membership.id,
      expenseId: expense.id,
    },
    orderBy: { submittedAt: "desc" },
    take: 10,
  });

  const now = new Date();
  const dueSoonEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  let dueState = "NO_DUE_DATE";
  if (expense.dueAt) {
    if (expense.dueAt.getTime() < now.getTime()) dueState = "OVERDUE";
    else if (expense.dueAt.getTime() <= dueSoonEnd.getTime())
      dueState = "DUE_SOON";
    else dueState = "UPCOMING";
  }

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title={expense.title}
        description={`${expense.category} · Payment details for your share`}
        actions={<StatusBadge status={dueState} />}
      />

      {!allocation ? (
        <EmptyState
          title="Not allocated"
          description="You do not have a charge on this expense."
        />
      ) : (
        <>
          <dl className="grid gap-4 card-surface p-5 sm:grid-cols-3">
            <div>
              <dt className="type-caption">Your charge</dt>
              <dd className="mt-1">
                <MoneyText cents={charge} size="lg" />
              </dd>
            </div>
            <div>
              <dt className="type-caption">Paid toward this expense</dt>
              <dd className="mt-1">
                <MoneyText cents={paidToward} size="lg" />
              </dd>
            </div>
            <div>
              <dt className="type-caption">Remaining on expense</dt>
              <dd className="mt-1">
                <MoneyText cents={remainingOnExpense} size="lg" />
              </dd>
            </div>
          </dl>

          <p className="text-sm text-muted">
            Due{" "}
            {expense.dueAt
              ? expense.dueAt.toISOString().slice(0, 10)
              : "date not set"}
            {" · "}
            Contribution outstanding overall:{" "}
            <MoneyText cents={outstanding} />
          </p>

          {openCycle && remainingOnExpense > 0 && outstanding > 0 ? (
            <PaymentMethodPanel
              communityId={communityId}
              expenseId={expense.id}
              requiredAmountCents={remainingOnExpense}
            />
          ) : (
            <p className="type-caption rounded-xl border border-border bg-surface px-4 py-3">
              {remainingOnExpense <= 0
                ? "Nothing left to pay on this expense."
                : "No outstanding contribution balance to submit against."}
            </p>
          )}

          <section aria-labelledby="submissions-heading" className="space-y-3">
            <h2 id="submissions-heading" className="type-h3">
              Your submissions
            </h2>
            {submissions.length === 0 ? (
              <p className="type-caption">No submissions for this expense yet.</p>
            ) : (
              <ul className="divide-y divide-border border border-border bg-surface">
                {submissions.map((sub) => (
                  <li
                    key={sub.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <MoneyText cents={sub.amountCents} className="font-semibold" />
                      <p className="type-caption">
                        {sub.method.replaceAll("_", " ")}
                        {" · "}
                        {sub.submittedAt.toISOString().slice(0, 10)}
                      </p>
                    </div>
                    <StatusBadge status={sub.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
