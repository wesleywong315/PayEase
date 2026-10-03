import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { SettlementCashForm } from "@/components/SettlementCashForm";
import { getCommunityOrNotFound, getCurrentCycle } from "@/lib/community";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";
import { getSettlementRows } from "@/server/services/reports";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function SettlementPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const cycle = await getCurrentCycle(communityId);
  const user = await getSessionUser();
  const membership = user
    ? await getActiveMembership(communityId, user.id)
    : null;
  const isCoordinator = membership?.role === "COORDINATOR";

  if (!cycle || !membership) {
    return (
      <div className="space-y-8">
        <PageHeader
          showBack={false}
          eyebrow={community.name}
          title="Settlement"
          description="Per-member charges and outstanding balances."
        />
        <EmptyState title={!cycle ? "No cycle" : "Members only"} />
      </div>
    );
  }

  const { rows, treasurerCashCents } = await getSettlementRows({
    communityId,
    cycleId: cycle.id,
    viewerMembershipId: membership.id,
    isCoordinator: Boolean(isCoordinator),
  });

  const cashMembers = isCoordinator
    ? await prisma.membership.findMany({
        where: { communityId, status: { in: ["ACTIVE", "LEFT"] } },
        include: { user: { select: { displayName: true } } },
        orderBy: { joinedAt: "asc" },
      })
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={cycle.name}
        title="Settlement"
        description="Committed charges, PayAid applied, and outstanding contribution/reimbursement. Tracking ledger only."
      />

      <p className="text-sm">
        Treasurer cash:{" "}
        <MoneyText cents={treasurerCashCents} className="font-semibold" />
        {cycle.status === "CLOSED" ? " · Cycle closed" : ""}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="No settlement rows yet"
          description="Commit expenses to build per-member final charges."
        />
      ) : (
        <div className="overflow-x-auto border border-border bg-surface">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              Per-member settlement for {cycle.name}
            </caption>
            <thead className="border-b border-border bg-background text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Member
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Baseline
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  PayAid applied
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Equal cover
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Final charge
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Contribution due
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Reimbursement due
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.membershipId}
                  className="border-b border-border last:border-0"
                >
                  <th scope="row" className="px-4 py-3 font-medium">
                    {row.displayName}
                  </th>
                  <td className="px-4 py-3">
                    <MoneyText cents={row.baselineCents} />
                  </td>
                  <td className="px-4 py-3">
                    <MoneyText cents={row.hardshipAppliedCents} />
                  </td>
                  <td className="px-4 py-3">
                    <MoneyText cents={row.equalCoverAppliedCents} />
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    <MoneyText cents={row.finalChargeCents} />
                  </td>
                  <td className="px-4 py-3">
                    <MoneyText cents={row.contributionOutstandingCents} />
                  </td>
                  <td className="px-4 py-3">
                    <MoneyText cents={row.reimbursementOutstandingCents} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCoordinator && cycle.status === "OPEN" ? (
        <SettlementCashForm
          communityId={communityId}
          members={cashMembers.map((m) => ({
            id: m.id,
            displayName: m.user.displayName,
          }))}
        />
      ) : null}
    </div>
  );
}
