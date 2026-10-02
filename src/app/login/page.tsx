import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";
import { PageHeader } from "@/components/PageHeader";
import { DEMO } from "../../../prisma/demo-ids";
import { prisma } from "@/lib/db";
import { getSessionUser, safeNextPath } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Log in",
};

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const sessionUser = await getSessionUser();
  if (sessionUser) {
    redirect(nextPath);
  }

  const demoIds = Object.values(DEMO.users).map((u) => u.id);
  const users = await prisma.user.findMany({
    where: { id: { in: demoIds } },
    orderBy: { displayName: "asc" },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: { community: { select: { name: true } } },
      },
    },
  });

  const demoUsers = users.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    roleLabels: user.memberships.map(
      (m) =>
        `${m.role === "COORDINATOR" ? "Coordinator" : "Member"} · ${m.community.name}`,
    ),
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <Link href="/" className="focus-ring inline-flex rounded-lg">
          <Logo />
        </Link>
      </div>

      <PageHeader
        eyebrow="Sign in"
        title="Log in"
        description="Use your username and password, or open Demo accounts for seeded hackathon users."
        backHref="/"
        backLabel="Back to landing"
      />

      <div className="mt-8">
        {demoUsers.length === 0 ? (
          <EmptyState
            title="No demo users found"
            description="Run the database seed, then refresh this page. You can still create a new account from Demo accounts after seeding."
          />
        ) : null}
        <LoginForm users={demoUsers} nextPath={nextPath} />
      </div>
    </main>
  );
}
