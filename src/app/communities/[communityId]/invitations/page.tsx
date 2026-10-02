import Link from "next/link";
import { InvitationManager } from "@/components/InvitationManager";
import { PageHeader } from "@/components/PageHeader";
import { getCommunityOrNotFound } from "@/lib/community";
import { requireSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function InvitationsPage({ params, searchParams }: PageProps) {
  const { communityId } = await params;
  const query = await searchParams;
  const user = await requireSessionUser(`/communities/${communityId}/invitations`);
  const community = await getCommunityOrNotFound(communityId);
  const membership = await getActiveMembership(communityId, user.id);

  if (!membership || membership.role !== "COORDINATOR") {
    return (
      <div className="space-y-4">
        <PageHeader
          showBack={false}
          title="Invitations"
          description="Only coordinators can create or revoke community invitations."
        />
        <p role="alert" className="text-sm text-danger">
          <span aria-hidden="true" className="mr-1">
            !
          </span>
          You need coordinator access in this community.
        </p>
        <Link
          href={`/communities/${communityId}`}
          className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Back to community home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title="Members / Invitations"
        description="Generate QR invitations and shareable links. Tokens expire after 7 days by default and grant Member role only."
      />

      {query.created === "1" ? (
        <p
          role="status"
          className="rounded-xl border border-success/30 bg-success-bg px-4 py-3 text-sm text-success"
        >
          <span aria-hidden="true" className="mr-1">
            ✓
          </span>
          Community created. Share an invitation, then create a financial cycle
          from the dashboard before committing expenses.
        </p>
      ) : null}

      <InvitationManager
        communityId={community.id}
        communityName={community.name}
      />
    </div>
  );
}
