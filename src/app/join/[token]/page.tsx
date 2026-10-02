import { JoinConfirmCard } from "@/components/JoinConfirmCard";
import { PageHeader } from "@/components/PageHeader";
import { getSessionUser } from "@/server/auth/current-user";
import {
  DomainError,
  getInvitationPreview,
} from "@/server/services/communities";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinTokenPage({ params }: PageProps) {
  const { token } = await params;
  const user = await getSessionUser();

  let preview: Awaited<ReturnType<typeof getInvitationPreview>> | null = null;
  let loadError: string | null = null;

  try {
    preview = await getInvitationPreview(token);
  } catch (error) {
    if (error instanceof DomainError) {
      loadError = error.message;
    } else {
      loadError = "Could not load this invitation.";
    }
  }

  let alreadyMember = false;
  if (user && preview) {
    const membership = await prisma.membership.findUnique({
      where: {
        communityId_userId: {
          communityId: preview.community.id,
          userId: user.id,
        },
      },
    });
    alreadyMember = membership?.status === "ACTIVE";
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <PageHeader
        showBack
        backHref="/join"
        backLabel="Back to join tools"
        title="Join confirmation"
        description="Review the community before confirming membership."
      />

      <div className="mt-8">
        {loadError || !preview ? (
          <div
            role="alert"
            className="card-surface space-y-2 border-danger/30 p-5 text-danger"
          >
            <p className="font-semibold">
              <span aria-hidden="true" className="mr-1">
                !
              </span>
              Invitation unavailable
            </p>
            <p className="text-sm">{loadError ?? "Unknown error."}</p>
            <p className="text-sm text-muted">
              Ask a coordinator for a new invitation link.
            </p>
          </div>
        ) : (
          <JoinConfirmCard
            token={token}
            preview={{
              community: preview.community,
              coordinatorName: preview.coordinatorName,
              roleGranted: preview.roleGranted,
              expiresAt: preview.expiresAt.toISOString(),
            }}
            signedIn={Boolean(user)}
            alreadyMember={alreadyMember}
          />
        )}
      </div>
    </main>
  );
}
