"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { MoneyText } from "@/components/MoneyText";

export type CommunityRibbonData = {
  membershipId: string;
  communityId: string;
  name: string;
  role: "COORDINATOR" | "MEMBER";
  activityLabel: string;
  contributionOutstandingCents: number;
  reimbursementOutstandingCents: number;
  hidden: boolean;
};

type Props = {
  community: CommunityRibbonData;
};

function IconEyeSlash({ className }: { className?: string }) {
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
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
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
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  );
}

export function CommunityRibbonRow({ community }: Props) {
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function setHidden(hidden: boolean) {
    setError(null);
    setOpen(false);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/communities/${community.communityId}/profile-visibility`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hidden }),
          },
        );
        const raw = await response.text();
        const data = (
          raw
            ? (JSON.parse(raw) as { error?: { message?: string } })
            : {}
        ) as { error?: { message?: string } };
        if (!response.ok) {
          setError(
            data.error?.message ??
              `Could not update visibility (${response.status}).`,
          );
          return;
        }
        router.refresh();
      } catch {
        setError("Could not update visibility.");
      }
    });
  }

  return (
    <li className="relative">
      <div className="flex items-stretch gap-1">
        <Link
          href={`/communities/${community.communityId}`}
          className="focus-ring flex min-w-0 flex-1 items-start gap-3 px-4 py-4 transition hover:bg-canvas/80"
        >
          <InitialsAvatar name={community.name} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="truncate font-semibold text-ink">{community.name}</p>
              <span className="type-caption shrink-0">
                {community.activityLabel}
              </span>
            </div>
            <p className="type-caption">
              Your role:{" "}
              {community.role === "COORDINATOR"
                ? "Coordinator (collection contact)"
                : "Member"}
              {community.hidden ? " · Hidden" : ""}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {community.contributionOutstandingCents > 0 ? (
                <span className="rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
                  You owe{" "}
                  <MoneyText
                    cents={community.contributionOutstandingCents}
                    className="inline"
                  />
                </span>
              ) : null}
              {community.reimbursementOutstandingCents > 0 ? (
                <span className="rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success">
                  Reimbursement due{" "}
                  <MoneyText
                    cents={community.reimbursementOutstandingCents}
                    className="inline"
                  />
                </span>
              ) : null}
              {community.contributionOutstandingCents === 0 &&
              community.reimbursementOutstandingCents === 0 ? (
                <span className="type-caption">No outstanding balances</span>
              ) : null}
            </div>
          </div>
        </Link>

        <div
          ref={rootRef}
          className="relative flex shrink-0 items-start px-1 py-3 pr-3"
        >
          <button
            type="button"
            aria-label={`More actions for ${community.name}`}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            disabled={pending}
            onClick={() => setOpen((value) => !value)}
            className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink disabled:opacity-60"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-5"
              aria-hidden="true"
            >
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>

          {open ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-3 top-12 z-20 min-w-[10.5rem] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
            >
              {community.hidden ? (
                <button
                  type="button"
                  role="menuitem"
                  className="focus-ring flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-canvas"
                  onClick={() => setHidden(false)}
                >
                  <IconEye className="size-5 shrink-0 text-muted" />
                  Unhide
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className="focus-ring flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-canvas"
                  onClick={() => setHidden(true)}
                >
                  <IconEyeSlash className="size-5 shrink-0 text-muted" />
                  Hide
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="px-4 pb-3 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
