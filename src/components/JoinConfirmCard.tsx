"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { MoneyText } from "@/components/MoneyText";
import { parseFeatureToggles } from "@/lib/feature-toggles";

type AcceptedRulePreview = {
  id: string;
  title: string;
  bodyMarkdown: string;
  versionNumber: number;
  featureTogglesJson: string;
  equalShareFallbackWhenZeroUsage: boolean;
  cycleBudgetCapCents: number | null;
  acceptedAt: string | null;
};

type JoinConfirmProps = {
  token: string;
  preview: {
    community: { id: string; name: string; description: string | null };
    coordinatorName: string;
    roleGranted: "MEMBER";
    expiresAt: string;
    openCycle: { id: string; name: string } | null;
    acceptedRule: AcceptedRulePreview | null;
  };
  signedIn: boolean;
  alreadyMember: boolean;
};

type Step = "overview" | "rules";

export function JoinConfirmCard({
  token,
  preview,
  signedIn,
  alreadyMember,
}: JoinConfirmProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("overview");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggles = preview.acceptedRule
    ? parseFeatureToggles(preview.acceptedRule.featureTogglesJson)
    : null;

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

  if (step === "rules") {
    return (
      <div className="card-surface space-y-5 p-6">
        <div>
          <p className="type-caption">Step 2 of 2 · Community rules</p>
          <h1 className="type-h2 mt-1">Review before joining</h1>
          <p className="type-body mt-2 text-muted">
            By confirming, you agree to uphold the current accepted rules for{" "}
            {preview.community.name}
            {preview.openCycle ? ` (${preview.openCycle.name})` : ""}.
          </p>
        </div>

        {!preview.acceptedRule ? (
          <div className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
            This community has no accepted rule version yet. You can still join;
            coordinators may publish rules later.
          </div>
        ) : (
          <article className="space-y-4 rounded-xl border border-border bg-canvas p-4">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-ink">
                {preview.acceptedRule.title}
              </h2>
              <p className="type-caption">
                Version {preview.acceptedRule.versionNumber}
                {preview.acceptedRule.acceptedAt
                  ? ` · Accepted ${preview.acceptedRule.acceptedAt.slice(0, 10)}`
                  : null}
              </p>
            </header>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {preview.acceptedRule.bodyMarkdown}
            </div>
            {toggles ? (
              <ul className="space-y-1 border-t border-border pt-3 type-caption">
                <li>
                  Equal-share fallback when usage is zero:{" "}
                  {preview.acceptedRule.equalShareFallbackWhenZeroUsage
                    ? "On"
                    : "Off"}
                </li>
                <li>
                  PayAid: {toggles.hardshipEnabled ? "Enabled" : "Disabled"}
                </li>
                <li>
                  Withdrawals:{" "}
                  {toggles.withdrawalsEnabled ? "Enabled" : "Disabled"}
                </li>
                <li>
                  Contributions:{" "}
                  {toggles.contributionsEnabled ? "Enabled" : "Disabled"}
                </li>
                <li>
                  Cycle budget cap:{" "}
                  {preview.acceptedRule.cycleBudgetCapCents == null ? (
                    "None"
                  ) : (
                    <MoneyText
                      cents={preview.acceptedRule.cycleBudgetCapCents}
                      className="inline"
                    />
                  )}
                </li>
              </ul>
            ) : null}
          </article>
        )}

        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="focus-ring mt-1"
          />
          <span>
            I have read these rules and agree to uphold them as a member of this
            community.
          </span>
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending || !agreed}
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
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setAgreed(false);
              setStep("overview");
            }}
            className="focus-ring rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink"
          >
            Back
          </button>
        </div>

        {error ? (
          <p role="alert" className="flex gap-2 text-sm text-danger">
            <span aria-hidden="true">!</span>
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card-surface space-y-5 p-6">
      <p className="type-caption">Step 1 of 2 · Community overview</p>
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
        Next you’ll review the community’s current spending rules. Confirming
        join records that you accept those rules. You are not added to past
        expenses automatically.
      </p>

      {!signedIn ? (
        <div className="space-y-3">
          <p className="type-caption">
            Sign in to continue. You’ll return to this invitation afterward.
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
            className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white"
            onClick={() => {
              setError(null);
              setStep("rules");
            }}
          >
            Next: Review rules
          </button>
          <Link
            href="/profile/communities"
            className="focus-ring rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink"
          >
            Cancel
          </Link>
        </div>
      )}
    </div>
  );
}
