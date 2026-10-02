import { CommunityNav } from "@/components/CommunityNav";
import { getCommunityOrNotFound } from "@/lib/community";
import { getSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ communityId: string }>;
};

export default async function CommunityLayout({ children, params }: LayoutProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const user = await getSessionUser();
  const membership = user
    ? await getActiveMembership(communityId, user.id)
    : null;

  return (
    <div className="min-h-[calc(100vh-2.5rem)]">
      <CommunityNav
        communityId={community.id}
        communityName={community.name}
        role={membership?.role ?? null}
      />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
