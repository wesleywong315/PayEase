import { notFound } from "next/navigation";
import { AllocationPreviewTable } from "@/components/AllocationPreviewTable";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound } from "@/lib/community";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string; expenseId: string }>;
};

export default async function ExpenseDetailPage({ params }: PageProps) {
  const { communityId, expenseId } = await params;
  const community = await getCommunityOrNotFound(communityId);

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, communityId },
    include: {
      frontedBy: {
        include: { user: { select: { displayName: true } } },
      },
      createdBy: {
        include: { user: { select: { displayName: true } } },
      },
      participants: {
        include: {
          membership: {
            include: { user: { select: { displayName: true } } },
          },
        },
        orderBy: { membershipId: "asc" },
      },
      allocations: {
        include: {
          membership: {
            include: { user: { select: { displayName: true } } },
          },
        },
        orderBy: { membershipId: "asc" },
      },
    },
  });

  if (!expense) {
    notFound();
  }

  const allocationRows = expense.allocations.map((row) => ({
    membershipId: row.membershipId,
    name: row.membership.user.displayName,
    fixedCents: row.fixedShareCents,
    usageCents: row.usageShareCents,
    baselineCents: row.baselineCents,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title={expense.title}
        description={`${expense.category} · Usage label: ${expense.usageLabel}`}
        actions={<StatusBadge status={expense.status} />}
      />

      <dl className="grid gap-4 border border-border bg-surface p-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted">Fixed</dt>
          <dd className="mt-1 text-lg font-semibold">
            <MoneyText cents={expense.fixedCents} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Variable</dt>
          <dd className="mt-1 text-lg font-semibold">
            <MoneyText cents={expense.variableCents} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Total</dt>
          <dd className="mt-1 text-lg font-semibold">
            <MoneyText cents={expense.totalCents} />
          </dd>
        </div>
      </dl>

      <p className="text-sm text-muted">
        Created by {expense.createdBy.user.displayName}
        {expense.frontedBy
          ? ` · Fronted by ${expense.frontedBy.user.displayName}`
          : ""}
        {expense.committedAt
          ? ` · Committed ${expense.committedAt.toISOString().slice(0, 10)}`
          : ""}
      </p>

      {expense.status === "COMMITTED" ? (
        <section aria-labelledby="allocation-heading" className="space-y-3">
          <h2 id="allocation-heading" className="text-xl font-semibold">
            Stored allocations
          </h2>
          <AllocationPreviewTable rows={allocationRows} />
        </section>
      ) : (
        <section aria-labelledby="participants-heading" className="space-y-3">
          <h2 id="participants-heading" className="text-xl font-semibold">
            Participants
          </h2>
          <p className="rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
            Preview engine — Phase 2/3. Draft expenses show participants only;
            live allocation preview is not computed in this shell.
          </p>
          <ul className="divide-y divide-border border border-border bg-surface">
            {expense.participants.map((participant) => (
              <li
                key={participant.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium text-foreground">
                  {participant.membership.user.displayName}
                </span>
                <span className="text-muted">
                  {participant.usageUnits} {expense.usageLabel.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
