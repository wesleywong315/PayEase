import { InitialsAvatar } from "@/components/InitialsAvatar";
import { LogoutButton } from "@/components/LogoutButton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const user = await requireSessionUser("/profile");

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: {
      community: { select: { id: true, name: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Demo profile for the signed-in user."
        backHref="/communities"
        backLabel="Back to My communities"
      />

      <section className="card-surface mt-8 flex items-center gap-4 p-5">
        <InitialsAvatar name={user.displayName} size="lg" />
        <div>
          <h2 className="type-h3">{user.displayName}</h2>
          <p className="type-caption">{user.email ?? "No email on file"}</p>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="type-h3">Communities and roles</h2>
        <ul className="card-surface divide-y divide-border">
          {memberships.map((membership) => (
            <li
              key={membership.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <p className="font-medium text-ink">{membership.community.name}</p>
                <p className="type-caption">Status: {membership.status}</p>
              </div>
              <StatusBadge status={membership.role} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <p className="type-caption rounded-xl border border-border bg-surface px-4 py-3">
          <span aria-hidden="true" className="mr-1">
            ⚠
          </span>
          Demo authentication only. No password vault or production identity
          provider is connected.
        </p>
        <LogoutButton />
      </section>
    </main>
  );
}
