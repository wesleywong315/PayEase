"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { parseHkdToCents } from "@/lib/money";

type CategoryOption = { id: string; name: string };

type CreditFormProps = {
  communityId: string;
  categories: CategoryOption[];
};

function receivedAtIsoFromDateInput(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toISOString();
}

export function CreditForm({ communityId, categories }: CreditFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [categoryMode, setCategoryMode] = useState<"reuse" | "onetime">(
    categories.length > 0 ? "reuse" : "onetime",
  );
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [amountHkd, setAmountHkd] = useState("");
  const [payAidHkd, setPayAidHkd] = useState("0");
  const [note, setNote] = useState("");
  const [receivedDate, setReceivedDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card-surface space-y-5 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const amountCents = parseHkdToCents(amountHkd);
            if (amountCents === null || amountCents <= 0) {
              throw new Error("Enter a valid positive HKD amount.");
            }
            const payAidCents = parseHkdToCents(payAidHkd);
            if (payAidCents === null || payAidCents < 0) {
              throw new Error("Enter a valid PayAid amount (0 is allowed).");
            }
            if (payAidCents > amountCents) {
              throw new Error("PayAid slice cannot exceed the credit amount.");
            }
            const equalCoverCents = amountCents - payAidCents;
            if (!title.trim()) {
              throw new Error("Enter a title.");
            }
            if (!receivedDate) {
              throw new Error("Choose a received date.");
            }
            const isOneTime = categoryMode === "onetime";
            if (isOneTime && !categoryLabel.trim()) {
              throw new Error("Enter a category label.");
            }
            if (!isOneTime && !categoryId) {
              throw new Error("Select a credit category.");
            }

            const response = await fetch(
              `/api/communities/${communityId}/credits`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title,
                  categoryId: isOneTime ? null : categoryId,
                  categoryLabel: isOneTime ? categoryLabel : "",
                  isOneTimeCategory: isOneTime,
                  amountCents,
                  equalCoverCents,
                  payAidCents,
                  note: note.trim() || null,
                  receivedAt: receivedAtIsoFromDateInput(receivedDate),
                  idempotencyKey: `credit:${crypto.randomUUID()}`,
                }),
              },
            );
            const data = (await response.json()) as {
              error?: { message?: string };
            };
            if (!response.ok) {
              setError(data.error?.message ?? "Could not record credit.");
              return;
            }
            router.push(`/communities/${communityId}/finance`);
            router.refresh();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Could not record credit.",
            );
          }
        });
      }}
    >
      <div className="space-y-2">
        <label htmlFor="credit-title" className="text-sm font-semibold text-ink">
          Title
        </label>
        <input
          id="credit-title"
          required
          minLength={2}
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Hall subsidy Autumn 2026"
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-ink"
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">Category</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="credit-category-mode"
              checked={categoryMode === "reuse"}
              onChange={() => setCategoryMode("reuse")}
              disabled={categories.length === 0}
            />
            Reusable category
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="credit-category-mode"
              checked={categoryMode === "onetime"}
              onChange={() => setCategoryMode("onetime")}
            />
            One-time label
          </label>
        </div>
        {categoryMode === "reuse" ? (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-ink"
            required
          >
            {categories.length === 0 ? (
              <option value="">No categories yet</option>
            ) : (
              categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        ) : (
          <input
            required
            maxLength={60}
            value={categoryLabel}
            onChange={(e) => setCategoryLabel(e.target.value)}
            placeholder="e.g. University grant"
            className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-ink"
          />
        )}
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="credit-amount" className="text-sm font-semibold text-ink">
          Amount (HKD)
        </label>
        <input
          id="credit-amount"
          required
          inputMode="decimal"
          value={amountHkd}
          onChange={(e) => setAmountHkd(e.target.value)}
          placeholder="0.00"
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-ink"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="credit-payaid" className="text-sm font-semibold text-ink">
          Of which PayAid (HKD)
        </label>
        <p className="type-caption">
          Remainder is split equally among members active at record time. This
          split cannot be changed later.
        </p>
        <input
          id="credit-payaid"
          required
          inputMode="decimal"
          value={payAidHkd}
          onChange={(e) => setPayAidHkd(e.target.value)}
          placeholder="0.00"
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-ink"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="credit-received"
          className="text-sm font-semibold text-ink"
        >
          Received date
        </label>
        <input
          id="credit-received"
          type="date"
          required
          value={receivedDate}
          onChange={(e) => setReceivedDate(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-ink"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="credit-note" className="text-sm font-semibold text-ink">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="credit-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-ink"
        />
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      <button
        type="submit"
        disabled={pending}
        className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Recording…" : "Record credit"}
      </button>
    </form>
  );
}
