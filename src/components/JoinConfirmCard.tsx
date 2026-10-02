"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { InitialsAvatar } from "@/components/InitialsAvatar";

type JoinConfirmProps = {
  token: string;
  preview: {
    community: { id: string; name: string; description: string | null };
    coordinatorName: string;
    roleGranted: "MEMBER";
    expiresAt: string;
  };
  signedIn: boolean;
  alreadyMember: boolean;
};

export function JoinConfirmCard({
  token,
  preview,
  signedIn,
  alreadyMember,
}: JoinConfirmProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (alreadyMember) {
    return (
      <div className="card-surface space-y-4 p-6 text-center">
        <InitialsAvatar name={preview.community.name} size="lg" />
        <h1 className="type-h2">You’re already a member</h1>
        <p className="type-body text-muted">{preview.community.name}</p>
        <Link
          href={`/communities/${preview.community.id}`}
          className="focus-ring inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white"
        >
          Open community
        </Link>
      </div>
    );
  }

  return (
    <div className="card-surface space-y-5 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <InitialsAvatar name={preview.community.name} size="lg" />
        <h1 className="type-h2">{preview.community.name}</h1>
        {preview.community.description ? (
          <p className="type-body max-w-md text-muted">
            {preview.community.description}
          </p>
        ) : null}
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <dt className="text-muted">Coordinator</dt>
          <dd className="font-medium text-ink">{preview.coordinatorName}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <dt className="text-muted">Membership role</dt>
          <dd className="font-medium text-ink">Member</dd>
        </div>
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-muted">Invitation expires</dt>
          <dd className="font-medium text-ink">
            {new Date(preview.expiresAt).toISOString().slice(0, 10)}
          </dd>
        </div>
      </dl>

      <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-muted">
        Joining does not automatically accept spending rules or attach you to
        historical expenses. You’ll only be included in new commitments after
        relevant rule acceptance.
      </p>

      {!signedIn ? (
        <div className="space-y-3">
          <p className="type-caption">
            Sign in to confirm joining. You’ll return to this invitation
            afterward.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
            className="focus-ring inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white"
          >
            Log in to continue
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const response = await fetch(`/api/join/${token}`, {
                  method: "POST",
                });
                const data = (await response.json()) as {
                  community?: { id: string };
                  error?: { message?: string };
                };
                if (!response.ok || !data.community) {
                  setError(data.error?.message ?? "Could not join.");
                  return;
                }
                router.push(`/communities/${data.community.id}`);
                router.refresh();
              });
            }}
          >
            {pending ? "Joining…" : "Confirm join"}
          </button>
          <Link
            href="/communities"
            className="focus-ring rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink"
          >
            Cancel
          </Link>
        </div>
      )}

      {error ? (
        <p role="alert" className="flex gap-2 text-sm text-danger">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
