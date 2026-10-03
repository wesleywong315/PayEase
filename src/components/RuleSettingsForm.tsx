"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { parseHkdToCents } from "@/lib/money";

type RuleSettingsFormProps = {
  communityId: string;
  initial?: {
    title: string;
    bodyMarkdown: string;
    equalShareFallbackWhenZeroUsage: boolean;
    hardshipEnabled: boolean;
    withdrawalsEnabled: boolean;
    contributionsEnabled: boolean;
    cycleBudgetCapCents: number | null;
  };
};

function centsToHkdInput(cents: number | null): string {
  if (cents == null) return "";
  const dollars = Math.floor(cents / 100);
  const rem = cents % 100;
  return rem === 0 ? String(dollars) : `${dollars}.${String(rem).padStart(2, "0")}`;
}

export function RuleSettingsForm({ communityId, initial }: RuleSettingsFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(initial?.bodyMarkdown ?? "");
  const [equalShareFallback, setEqualShareFallback] = useState(
    initial?.equalShareFallbackWhenZeroUsage ?? true,
  );
  const [hardshipEnabled, setHardshipEnabled] = useState(
    initial?.hardshipEnabled ?? true,
  );
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(
    initial?.withdrawalsEnabled ?? true,
  );
  const [contributionsEnabled, setContributionsEnabled] = useState(
    initial?.contributionsEnabled ?? true,
  );
  const [budgetCapHkd, setBudgetCapHkd] = useState(
    centsToHkdInput(initial?.cycleBudgetCapCents ?? null),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card-surface space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          let cycleBudgetCapCents: number | null = null;
          const capRaw = budgetCapHkd.trim();
          if (capRaw !== "") {
            const parsed = parseHkdToCents(capRaw);
            if (parsed === null) {
              setError("Cycle budget cap must be a valid HKD amount, or leave empty.");
              return;
            }
            cycleBudgetCapCents = parsed;
          }

          const response = await fetch(`/api/communities/${communityId}/rules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              bodyMarkdown,
              equalShareFallbackWhenZeroUsage: equalShareFallback,
              featureToggles: {
                hardshipEnabled,
                withdrawalsEnabled,
                contributionsEnabled,
              },
              cycleBudgetCapCents,
            }),
          });
          const data = (await response.json()) as {
            error?: { message?: string };
          };
          if (!response.ok) {
            setError(data.error?.message ?? "Could not propose rule version.");
            return;
          }
          router.refresh();
        });
      }}
    >
      <h2 className="type-h3">Propose a new rule version</h2>
      <p className="type-caption">
        Active members at propose time must each accept before this version
        becomes binding. Feature toggles never rewrite committed history.
      </p>

      <div className="space-y-2">
        <label htmlFor="rule-title" className="type-caption font-semibold text-ink">
          Title
        </label>
        <input
          id="rule-title"
          required
          minLength={2}
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="rule-body" className="type-caption font-semibold text-ink">
          Body (markdown)
        </label>
        <textarea
          id="rule-body"
          required
          minLength={10}
          rows={6}
          value={bodyMarkdown}
          onChange={(e) => setBodyMarkdown(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={equalShareFallback}
          onChange={(e) => setEqualShareFallback(e.target.checked)}
          className="focus-ring"
        />
        Equal-share fallback when usage is zero
      </label>

      <fieldset className="space-y-2">
        <legend className="type-caption font-semibold text-ink">
          Feature toggles
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hardshipEnabled}
            onChange={(e) => setHardshipEnabled(e.target.checked)}
            className="focus-ring"
          />
          PayAid enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withdrawalsEnabled}
            onChange={(e) => setWithdrawalsEnabled(e.target.checked)}
            className="focus-ring"
          />
          Withdrawals enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={contributionsEnabled}
            onChange={(e) => setContributionsEnabled(e.target.checked)}
            className="focus-ring"
          />
          Contributions enabled
        </label>
      </fieldset>

      <div className="space-y-2">
        <label
          htmlFor="budget-cap"
          className="type-caption font-semibold text-ink"
        >
          Cycle budget cap (HKD, optional)
        </label>
        <input
          id="budget-cap"
          inputMode="decimal"
          value={budgetCapHkd}
          onChange={(e) => setBudgetCapHkd(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 font-mono text-sm text-ink"
          placeholder="Leave empty for uncapped"
        />
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      <button
        type="submit"
        disabled={pending}
        className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Proposing…" : "Propose version"}
      </button>
    </form>
  );
}
