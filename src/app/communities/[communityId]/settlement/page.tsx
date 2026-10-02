import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function SettlementPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const openCycle = await getOpenCycle(communityId);

  if (!openCycle) {
    return (
      <div className="space-y-8">
        <PageHeader
        showBack={false}
          eyebrow={community.name}
          title="Settlement"
          description="Per-member final charges from committed allocations."
        />
        <EmptyState title="No open cycle" />
      </div>
    );
  }

  const allocations = await prisma.allocation.findMany({
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
  });

  const byMember = new Map<
    string,
    {
      name: string;
      baselineCents: number;
      hardshipAppliedCents: number;
      finalChargeCents: number;
    }
  >();

  for (const row of allocations) {
    const existing = byMember.get(row.membershipId) ?? {
      name: row.membership.user.displayName,
      baselineCents: 0,
      hardshipAppliedCents: 0,
      finalChargeCents: 0,
    };
    existing.baselineCents += row.baselineCents;
    existing.hardshipAppliedCents += row.hardshipAppliedCents;
    existing.finalChargeCents += row.finalChargeCents;
    byMember.set(row.membershipId, existing);
  }

  const rows = Array.from(byMember.entries())
    .map(([membershipId, data]) => ({ membershipId, ...data }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={openCycle.name}
        title="Settlement"
        description="Aggregated final charges from committed expense allocations. Contribution and refund workflows arrive later."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No settlement rows yet"
          description="Commit expenses to build per-member final charges."
        />
      ) : (
        <div className="overflow-x-auto border border-border bg-surface">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              Per-member settlement for {openCycle.name}
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
                  Hardship applied
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Final charge
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
                    {row.name}
                  </th>
                  <td className="px-4 py-3">
                    <MoneyText cents={row.baselineCents} />
                  </td>
                  <td className="px-4 py-3">
                    <MoneyText cents={row.hardshipAppliedCents} />
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    <MoneyText cents={row.finalChargeCents} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
