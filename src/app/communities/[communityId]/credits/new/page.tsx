import Link from "next/link";
import { CategoryManager } from "@/components/CategoryManager";
import { CreditForm } from "@/components/CreditForm";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { requireSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";
import { listCreditCategories } from "@/server/services/credits";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function NewCreditPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const user = await requireSessionUser(
    `/communities/${communityId}/credits/new`,
  );
  const membership = await getActiveMembership(communityId, user.id);

  if (!membership || membership.role !== "COORDINATOR") {
    return (
      <div className="space-y-8">
        <PageHeader
          showBack={false}
          eyebrow={community.name}
          title="New credit"
        />
        <EmptyState
          title="Coordinator access required"
          description="Only community coordinators can record grants and subsidies."
          action={
            <Link
              href={`/communities/${communityId}/finance`}
              className="focus-ring text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              Back to finance
            </Link>
          }
        />
      </div>
    );
  }

  const openCycle = await getOpenCycle(communityId);
  if (!openCycle) {
    return (
      <div className="space-y-8">
        <PageHeader
          showBack={false}
          eyebrow={community.name}
          title="New credit"
        />
        <EmptyState
          title="No open cycle"
          description="Open a financial cycle before recording credits."
        />
      </div>
    );
  }

  const categories = await listCreditCategories(communityId, false);

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={openCycle.name}
        title="New credit"
        description="Record a grant, subsidy, or other pooled inflow. It appears under Funding in on the dashboard."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CreditForm
          communityId={communityId}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
        <CategoryManager
          communityId={communityId}
          kind="credit"
          initialCategories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            archivedAt: c.archivedAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </div>
  );
}
