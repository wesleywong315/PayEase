"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import type { ReactNode } from "react";

type TabId = "overview" | "expenses" | "community" | "report";

type BottomTab = {
  id: TabId;
  href: string;
  label: string;
  match: (pathname: string, base: string) => boolean;
  icon: ReactNode;
};

function IconHome({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function IconExpenses({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
      />
    </svg>
  );
}

function IconCommunity({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
      />
    </svg>
  );
}

function IconReports({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
      />
    </svg>
  );
}

const COMMUNITY_HUB_PREFIXES = [
  "/community",
  "/rules",
  "/withdrawals",
  "/updates",
  "/invitations",
  "/hardship",
  "/payaid",
  "/payments",
  "/settlement",
] as const;

function isCommunityHubPath(pathname: string, base: string): boolean {
  return COMMUNITY_HUB_PREFIXES.some(
    (prefix) =>
      pathname === `${base}${prefix}` ||
      pathname.startsWith(`${base}${prefix}/`),
  );
}

function isFinancePath(pathname: string, base: string): boolean {
  return (
    pathname === `${base}/finance` ||
    pathname.startsWith(`${base}/finance/`) ||
    pathname === `${base}/expenses` ||
    pathname.startsWith(`${base}/expenses/`) ||
    pathname === `${base}/credits` ||
    pathname.startsWith(`${base}/credits/`)
  );
}

function bottomTabs(base: string): BottomTab[] {
  return [
    {
      id: "overview",
      href: base,
      label: "Overview",
      match: (pathname, communityBase) =>
        pathname === communityBase || pathname === `${communityBase}/`,
      icon: <IconHome className="size-6" />,
    },
    {
      id: "expenses",
      href: `${base}/finance`,
      label: "Finance",
      match: isFinancePath,
      icon: <IconExpenses className="size-6" />,
    },
    {
      id: "community",
      href: `${base}/community`,
      label: "Community",
      match: isCommunityHubPath,
      icon: <IconCommunity className="size-6" />,
    },
    {
      id: "report",
      href: `${base}/report`,
      label: "Reports",
      match: (pathname, communityBase) =>
        pathname === `${communityBase}/report` ||
        pathname.startsWith(`${communityBase}/report/`),
      icon: <IconReports className="size-6" />,
    },
  ];
}

type CommunityNavProps = {
  communityId: string;
  communityName: string;
  role: "COORDINATOR" | "MEMBER" | null;
};

function communityParentHref(
  pathname: string,
  communityId: string,
  communityName: string,
): { href: string; label: string } {
  const base = `/communities/${communityId}`;
  const expenseDetail = pathname.match(
    new RegExp(`^/communities/${communityId}/expenses/[^/]+`),
  );

  if (expenseDetail) {
    return { href: `${base}/finance`, label: "Back to finance" };
  }

  if (pathname.startsWith(`${base}/credits`)) {
    return { href: `${base}/finance`, label: "Back to finance" };
  }

  if (pathname.startsWith(`${base}/payments/`)) {
    return { href: `${base}/payments`, label: "Back to My payments" };
  }

  if (isCommunityHubPath(pathname, base) && !pathname.startsWith(`${base}/community`)) {
    return { href: `${base}/community`, label: "Back to Community" };
  }

  if (pathname !== base && pathname !== `${base}/`) {
    return { href: base, label: `Back to ${communityName}` };
  }

  return { href: "/communities", label: "Back to My communities" };
}

export function CommunityNav({
  communityId,
  communityName,
  role,
}: CommunityNavProps) {
  const pathname = usePathname();
  const base = `/communities/${communityId}`;
  const back = communityParentHref(pathname, communityId, communityName);
  const tabs = bottomTabs(base);

  return (
    <>
      <header className="no-print border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <BackButton href={back.href} label={back.label} />
          <Link
            href={base}
            className="focus-ring min-w-0 flex-1 truncate text-sm font-semibold text-ink hover:text-primary"
          >
            {communityName}
          </Link>
          {role ? (
            <span className="type-caption shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              {role === "COORDINATOR" ? "Coordinator" : "Member"}
            </span>
          ) : null}
        </div>
      </header>

      <nav
        aria-label={`${communityName} sections`}
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="mx-auto grid max-w-5xl grid-cols-4">
          {tabs.map((tab) => {
            const isActive = tab.match(pathname, base);
            return (
              <li key={tab.id}>
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  title={tab.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`focus-ring flex flex-col items-center justify-center gap-0.5 px-2 py-2 transition-colors ${
                    isActive
                      ? "text-primary"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {tab.icon}
                  <span className="text-[10px] font-medium leading-none tracking-wide">
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
