import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { getSessionUser, safeNextPath } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Demo login",
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

  const users = await prisma.user.findMany({
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
        eyebrow="Demo authentication"
        title="Log in"
        description="Choose a seeded demo user. After login you land in your personal community inbox."
        backHref="/"
        backLabel="Back to landing"
      />

      <div className="mt-8">
        {demoUsers.length === 0 ? (
          <EmptyState
            title="No demo users found"
            description="Run the database seed, then refresh this page."
          />
        ) : (
          <LoginForm users={demoUsers} nextPath={nextPath} />
        )}
      </div>
    </main>
  );
}
