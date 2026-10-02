import Link from "next/link";
import { CreateCommunityForm } from "@/components/CreateCommunityForm";
import { PageHeader } from "@/components/PageHeader";
import { requireSessionUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create or join",
};

export default async function CommunityActionsPage() {
  await requireSessionUser("/communities/new");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Communities"
        title="Create or join a community"
        description="Create a community as coordinator, or join another team with an invitation."
        backHref="/communities"
        backLabel="Back to My communities"
      />

      <div className="mt-8 grid gap-8">
        <section className="space-y-3">
          <h2 className="type-h3">Create a community</h2>
          <CreateCommunityForm />
        </section>

        <section className="card-surface space-y-3 p-5">
          <h2 className="type-h3">Join a community</h2>
          <p className="type-caption">
            Scan a QR code, paste a link, or open a shared invitation URL. You’ll
            confirm before membership is created.
          </p>
          <Link
            href="/join"
            className="focus-ring inline-flex rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink"
          >
            Open join tools
          </Link>
        </section>
      </div>
    </main>
  );
}
