import Link from "next/link";
import {
  CommunityRibbonRow,
  type CommunityRibbonData,
} from "@/components/CommunityRibbonRow";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/server/auth/current-user";
import { getMembershipBalances } from "@/server/services/balances";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Communities",
};

function formatActivity(date: Date | null | undefined): string {
  if (!date) return "No recent activity";
  return `Updated ${date.toISOString().slice(0, 10)}`;
}

export default async function ProfileCommunitiesPage() {
  const user = await requireSessionUser("/profile/communities");

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      community: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          expenses: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { updatedAt: true },
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const balances = await getMembershipBalances(memberships.map((m) => m.id));

  const ribbons: CommunityRibbonData[] = memberships.map((membership) => {
    const balance = balances.get(membership.id);
    const latestExpense = membership.community.expenses[0]?.updatedAt;
    const activity = latestExpense ?? membership.community.createdAt;
    return {
      membershipId: membership.id,
      communityId: membership.communityId,
      name: membership.community.name,
      role: membership.role,
      activityLabel: formatActivity(activity),
      contributionOutstandingCents: balance?.contributionOutstandingCents ?? 0,
      reimbursementOutstandingCents:
        balance?.reimbursementOutstandingCents ?? 0,
      hidden: membership.hiddenFromProfile,
    };
  });

  const visible = ribbons.filter((r) => !r.hidden);
  const hidden = ribbons.filter((r) => r.hidden);

  return (
    <div className="space-y-6">
      <PageHeader
        showBack={false}
        eyebrow="Profile"
        title="Communities"
        description="Communities you belong to. Use ⋮ on a row to hide it from this list."
        actions={
          <Link
            href="/communities/new"
            aria-label="Create or join a community"
            className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-white"
            title="Create or join"
          >
            +
          </Link>
        }
      />

      {memberships.length === 0 ? (
        <EmptyState
          title="You haven’t joined a community yet."
          description="Create a community or join with an invitation."
          action={
            <div className="flex flex-wrap gap-3">
              <Link
                href="/communities/new"
                className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Create community
              </Link>
              <Link
                href="/join"
                className="focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink"
              >
                Join community
              </Link>
            </div>
          }
        />
      ) : (
        <>
          {visible.length === 0 ? (
            <EmptyState
              title="All communities are hidden"
              description="Use Unhide in a hidden row below to show a community again."
            />
          ) : (
            <ul className="card-surface divide-y divide-border overflow-hidden">
              {visible.map((community) => (
                <CommunityRibbonRow
                  key={community.membershipId}
                  community={community}
                />
              ))}
            </ul>
          )}

          {hidden.length > 0 ? (
            <section aria-labelledby="hidden-communities-heading" className="space-y-3">
              <h2
                id="hidden-communities-heading"
                className="text-sm font-semibold text-muted"
              >
                Hidden ({hidden.length})
              </h2>
              <ul className="card-surface divide-y divide-border overflow-hidden opacity-80">
                {hidden.map((community) => (
                  <CommunityRibbonRow
                    key={community.membershipId}
                    community={community}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
