import { JoinInviteTools } from "@/components/JoinInviteTools";
import { PageHeader } from "@/components/PageHeader";
import { getSessionUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Join a community",
};

export default async function JoinHelperPage() {
  const user = await getSessionUser();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Invitations"
        title="Join a community"
        description="Paste a link/token or scan a QR code. Confirmation never exposes community finances before you join."
        backHref={user ? "/profile/communities" : "/login"}
        backLabel={user ? "Back to My communities" : "Back to login"}
      />

      <div className="mt-8">
        <JoinInviteTools />
      </div>
    </main>
  );
}
