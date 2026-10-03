import Link from "next/link";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { ProfileNav } from "@/components/ProfileNav";
import { requireSessionUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

type LayoutProps = {
  children: React.ReactNode;
};

export default async function ProfileLayout({ children }: LayoutProps) {
  const user = await requireSessionUser("/profile");

  return (
    <div className="min-h-[calc(100vh-2.5rem)] pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))]">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/profile/report"
              className="focus-ring shrink-0 rounded-lg"
              aria-label="PayEase home"
            >
              <Logo showWordmark={false} markClassName="h-9 w-9" />
            </Link>
            <InitialsAvatar name={user.displayName} size="md" />
            <div className="min-w-0">
              <p className="type-caption">Signed in</p>
              <Link
                href="/profile/report"
                className="focus-ring block truncate text-sm font-semibold text-ink hover:text-primary"
              >
                {user.displayName}
              </Link>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">{children}</div>
      <ProfileNav />
    </div>
  );
}
