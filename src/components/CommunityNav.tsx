"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BackButton } from "@/components/BackButton";

type NavItem = {
  href: string;
  label: string;
  match: "exact" | "prefix";
  roles?: Array<"COORDINATOR" | "MEMBER">;
};

const NAV_ITEMS: NavItem[] = [
  { href: "", label: "Overview", match: "exact" },
  { href: "/rules", label: "Rules", match: "prefix" },
  { href: "/expenses", label: "Expenses", match: "prefix" },
  {
    href: "/invitations",
    label: "Members / Invitations",
    match: "prefix",
    roles: ["COORDINATOR"],
  },
  { href: "/hardship", label: "Hardship", match: "prefix" },
  { href: "/withdrawals", label: "Withdrawals", match: "prefix" },
  { href: "/settlement", label: "Settlement", match: "prefix" },
  { href: "/report", label: "Reports", match: "prefix" },
];

type CommunityNavProps = {
  communityId: string;
  communityName: string;
  role: "COORDINATOR" | "MEMBER" | null;
};

function communityParentHref(
  pathname: string,
  communityId: string,
  communityName: string,
): {
  href: string;
  label: string;
} {
  const base = `/communities/${communityId}`;
  const expenseDetail = pathname.match(
    new RegExp(`^/communities/${communityId}/expenses/[^/]+`),
  );

  if (expenseDetail) {
    return {
      href: `${base}/expenses`,
      label: "Back to expenses",
    };
  }

  if (pathname !== base && pathname !== `${base}/`) {
    return {
      href: base,
      label: `Back to ${communityName}`,
    };
  }

  return {
    href: "/communities",
    label: "Back to My communities",
  };
}

export function CommunityNav({
  communityId,
  communityName,
  role,
}: CommunityNavProps) {
  const pathname = usePathname();
  const base = `/communities/${communityId}`;
  const back = communityParentHref(pathname, communityId, communityName);

  const items = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return role ? item.roles.includes(role) : false;
  });

  return (
    <nav
      aria-label={`${communityName} sections`}
      className="no-print border-b border-border bg-surface"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <BackButton href={back.href} label={back.label} />
          <Link
            href={base}
            className="focus-ring type-h3 truncate text-ink hover:text-primary"
          >
            {communityName}
          </Link>
          {role ? (
            <span className="type-caption rounded-full bg-primary/10 px-2.5 py-1 text-primary">
              {role === "COORDINATOR" ? "Coordinator" : "Member"}
            </span>
          ) : null}
        </div>
        <ul className="flex flex-wrap gap-1">
          {items.map((item) => {
            const href = `${base}${item.href}`;
            const isActive =
              item.match === "exact"
                ? pathname === base || pathname === `${base}/`
                : pathname.startsWith(href);

            return (
              <li key={item.href}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`focus-ring inline-block rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-muted hover:bg-primary/10 hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
