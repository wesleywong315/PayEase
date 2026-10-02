import { notFound } from "next/navigation";
import { AllocationPreviewTable } from "@/components/AllocationPreviewTable";
import { CommitExpenseButton } from "@/components/CommitExpenseButton";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";
import { previewExpenseAllocation } from "@/server/services/expenses";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string; expenseId: string }>;
};

export default async function ExpenseDetailPage({ params }: PageProps) {
  const { communityId, expenseId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const user = await getSessionUser();
  const membership = user
    ? await getActiveMembership(communityId, user.id)
    : null;
  const isCoordinator = membership?.role === "COORDINATOR";
  const openCycle = await getOpenCycle(communityId);

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

  const draftPreview =
    expense.status === "DRAFT" && expense.participants.length > 0
      ? (() => {
          try {
            const result = previewExpenseAllocation({
              fixedCents: expense.fixedCents,
              variableCents: expense.variableCents,
              participants: expense.participants.map((p) => ({
                membershipId: p.membershipId,
                usageUnits: p.usageUnits,
              })),
            });
            return {
              rows: result.lines.map((line) => {
                const participant = expense.participants.find(
                  (p) => p.membershipId === line.membershipId,
                );
                return {
                  membershipId: line.membershipId,
                  name:
                    participant?.membership.user.displayName ??
                    line.membershipId,
                  fixedCents: line.fixedShareCents,
                  usageCents: line.usageShareCents,
                  baselineCents: line.baselineCents,
                };
              }),
              warnings: result.warnings,
            };
          } catch {
            return null;
          }
        })()
      : null;

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title={expense.title}
        description={`${expense.category} · Usage label: ${expense.usageLabel}`}
        actions={<StatusBadge status={expense.status} />}
      />

      <dl className="grid gap-4 border border-border bg-surface p-4 sm:grid-cols-4">
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
        <div>
          <dt className="text-sm text-muted">Due date</dt>
          <dd className="mt-1 text-lg font-semibold text-ink">
            {expense.dueAt
              ? expense.dueAt.toISOString().slice(0, 10)
              : "Not set"}
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

      {expense.status === "DRAFT" && isCoordinator && openCycle ? (
        <CommitExpenseButton
          communityId={communityId}
          expenseId={expense.id}
          cycleRevision={openCycle.revision}
        />
      ) : null}

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
          {draftPreview ? (
            <div className="space-y-2">
              <h3 className="type-h3">Allocation preview</h3>
              {draftPreview.warnings.length > 0 ? (
                <p className="rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
                  {draftPreview.warnings.join(" · ")}
                </p>
              ) : null}
              <AllocationPreviewTable rows={draftPreview.rows} />
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
