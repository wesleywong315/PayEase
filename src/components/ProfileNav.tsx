"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  icon: React.ReactNode;
};

function IconReport({ className }: { className?: string }) {
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

function IconCommunities({ className }: { className?: string }) {
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

const TABS: Tab[] = [
  {
    href: "/profile/report",
    label: "Report",
    match: (pathname) =>
      pathname === "/profile" ||
      pathname === "/profile/report" ||
      pathname.startsWith("/profile/report/"),
    icon: <IconReport className="size-6" />,
  },
  {
    href: "/profile/communities",
    label: "Communities",
    match: (pathname) =>
      pathname === "/profile/communities" ||
      pathname.startsWith("/profile/communities/"),
    icon: <IconCommunities className="size-6" />,
  },
];

export function ProfileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Profile sections"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex max-w-3xl flex-row items-stretch justify-center gap-2 px-3 py-2">
        {TABS.map((tab) => {
          const isActive = tab.match(pathname);
          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                aria-label={tab.label}
                title={tab.label}
                aria-current={isActive ? "page" : undefined}
                className={`focus-ring flex w-full flex-row items-center justify-center gap-2 rounded-full px-3 py-2.5 transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-canvas/80 hover:text-ink"
                }`}
              >
                {tab.icon}
                <span className="text-sm font-medium tracking-wide">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
