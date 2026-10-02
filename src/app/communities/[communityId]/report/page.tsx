import { CategoryDonut } from "@/components/CategoryDonut";
import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";
import { getCategoryReportSlices } from "@/server/services/reports";
import { buildDonutPath } from "@/lib/report-chart";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function ReportPage({ params }: PageProps) {
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
      <div className="space-y-8">
        <PageHeader
          showBack={false}
          eyebrow={community.name}
          title="Cycle report"
          description="Printable summary for the current financial cycle."
        />
        <EmptyState title="No open cycle" />
      </div>
    );
  }

  const [expenses, members, funding, allocations, categorySlices] =
    await Promise.all([
      prisma.expense.findMany({
        where: { communityId, cycleId: openCycle.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          totalCents: true,
          category: true,
        },
      }),
      prisma.membership.findMany({
        where: { communityId, status: "ACTIVE" },
        include: { user: { select: { displayName: true } } },
        orderBy: { joinedAt: "asc" },
      }),
      prisma.hardshipFunding.aggregate({
        where: { cycleId: openCycle.id, kind: "RECEIVED" },
        _sum: { amountCents: true },
      }),
      prisma.allocation.findMany({
        where: {
          expense: {
            communityId,
            cycleId: openCycle.id,
            status: "COMMITTED",
          },
        },
        include: {
          membership: {
            include: { user: { select: { displayName: true } } },
          },
        },
      }),
      getCategoryReportSlices({
        communityId,
        cycleId: openCycle.id,
      }),
    ]);

  const donutSegments = buildDonutPath(categorySlices);

  const committedTotal = expenses
    .filter((e) => e.status === "COMMITTED")
    .reduce((sum, e) => sum + e.totalCents, 0);

  const finalByMember = new Map<
    string,
    { membershipId: string; name: string; cents: number }
  >();
  for (const row of allocations) {
    const existing = finalByMember.get(row.membershipId) ?? {
      membershipId: row.membershipId,
      name: row.membership.user.displayName,
      cents: 0,
    };
    existing.cents += row.finalChargeCents;
    finalByMember.set(row.membershipId, existing);
  }

  const allCharges = Array.from(finalByMember.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // Privacy: members only see their own charge row; coordinators see all.
  const memberCharges = isCoordinator
    ? allCharges
    : allCharges.filter((row) => row.membershipId === membership?.id);

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title="Cycle report"
        description={
          isCoordinator
            ? `Full printable summary for ${openCycle.name}.`
            : `Your privacy-safe statement for ${openCycle.name}.`
        }
      />

      <div className="no-print rounded-md border border-border bg-background px-4 py-3 text-sm text-muted">
        Use your browser print dialog for a paper-friendly view. CSV export
        arrives in a later phase.
      </div>

      <article className="space-y-8 border border-border bg-surface p-6 print:border-0 print:p-0">
        <header className="space-y-1 border-b border-border pb-4">
          <h2 className="type-h2">{community.name}</h2>
          <p className="text-sm text-muted">
            {openCycle.name} · Status {openCycle.status}
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted">Committed expenses</p>
            <p className="mt-1 text-xl font-semibold">
              <MoneyText cents={committedTotal} />
            </p>
          </div>
          <div>
            <p className="text-sm text-muted">PayAid funding received</p>
            <p className="mt-1 text-xl font-semibold">
              <MoneyText cents={funding._sum.amountCents ?? 0} />
            </p>
          </div>
          <div>
            <p className="text-sm text-muted">Active members</p>
            <p className="mt-1 text-xl font-semibold">{members.length}</p>
          </div>
        </section>

        <section aria-labelledby="category-chart-heading" className="space-y-3">
          <h3 id="category-chart-heading" className="text-lg font-semibold">
            Spend by category
          </h3>
          <CategoryDonut segments={donutSegments} />
        </section>

        <section aria-labelledby="report-expenses-heading" className="space-y-3">
          <h3 id="report-expenses-heading" className="text-lg font-semibold">
            Expenses
          </h3>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted">No expenses recorded.</p>
          ) : (
            <ul className="divide-y divide-border border border-border">
              {expenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span>
                    {expense.title}{" "}
                    <span className="text-muted">({expense.category})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <MoneyText cents={expense.totalCents} />
                    <StatusBadge status={expense.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="report-charges-heading" className="space-y-3">
          <h3 id="report-charges-heading" className="text-lg font-semibold">
            {isCoordinator ? "Member final charges" : "Your final charges"}
          </h3>
          {memberCharges.length === 0 ? (
            <p className="text-sm text-muted">
              {isCoordinator
                ? "No committed allocations yet."
                : "You have no committed charges in this cycle."}
            </p>
          ) : (
            <ul className="divide-y divide-border border border-border">
              {memberCharges.map((row) => (
                <li
                  key={row.membershipId}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>{row.name}</span>
                  <MoneyText cents={row.cents} className="font-semibold" />
                </li>
              ))}
            </ul>
          )}
          {!isCoordinator ? (
            <p className="type-caption">
              Other members&apos; individual charges are hidden for privacy.
            </p>
          ) : null}
        </section>

        <footer className="border-t border-border pt-4 text-xs text-muted">
          Hackathon prototype — no real payments. Generated as a read-only view.
        </footer>
      </article>
    </div>
  );
}
