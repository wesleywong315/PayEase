import { EmptyState } from "@/components/EmptyState";
import { MarkUpdateReadButton } from "@/components/MarkUpdateReadButton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound } from "@/lib/community";
import { requireSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";
import { listCommunityUpdates } from "@/server/services/payments";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function UpdatesPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const user = await requireSessionUser(`/communities/${communityId}/updates`);
  const membership = await getActiveMembership(communityId, user.id);

  if (!membership || membership.role !== "COORDINATOR") {
    return (
      <div className="space-y-8">
        <PageHeader showBack={false} eyebrow={community.name} title="Updates" />
        <EmptyState
          title="Coordinator access required"
          description="The updates feed is for community coordinators."
        />
      </div>
    );
  }

  const updates = await listCommunityUpdates(communityId);

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title="Updates"
        description="Payment submissions and confirmations for this community."
      />

      {updates.length === 0 ? (
        <EmptyState
          title="No updates yet"
          description="Payment activity will appear here."
        />
      ) : (
        <ul className="divide-y divide-border border border-border bg-surface">
          {updates.map((note) => {
            const readByMe = note.reads.some(
              (r) => r.membershipId === membership.id,
            );
            return (
              <li
                key={note.id}
                className={`space-y-2 px-4 py-4 ${readByMe ? "" : "bg-primary/5"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{note.title}</p>
                      <StatusBadge status={note.kind} />
                      {!readByMe ? (
                        <span className="type-caption font-semibold text-primary">
                          Unread
                        </span>
                      ) : null}
                    </div>
                    <p className="type-caption mt-1">
                      {note.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </p>
                  </div>
                  {!readByMe ? (
                    <MarkUpdateReadButton
                      communityId={communityId}
                      notificationId={note.id}
                    />
                  ) : null}
                </div>
                <p className="text-sm text-foreground">{note.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
