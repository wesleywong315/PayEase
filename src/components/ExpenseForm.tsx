"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  AllocationPreviewTable,
  type AllocationPreviewRow,
} from "@/components/AllocationPreviewTable";
import { ErrorAlert } from "@/components/ErrorAlert";
import { parseHkdToCents } from "@/lib/money";

type MemberOption = { id: string; displayName: string };
type CategoryOption = { id: string; name: string };

export type ExpenseFormInitial = {
  title: string;
  categoryId: string | null;
  categoryLabel: string;
  isOneTimeCategory: boolean;
  fixedCents: number;
  variableCents: number;
  usageLabel: string;
  dueAt: string | null;
  frontedByMembershipId: string | null;
  participants: Array<{ membershipId: string; usageUnits: number }>;
};

type ExpenseFormProps = {
  communityId: string;
  cycleRevision: number;
  members: MemberOption[];
  categories: CategoryOption[];
  expenseId?: string;
  initial?: ExpenseFormInitial;
};

function centsToHkdInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dueAtIsoFromDateInput(date: string): string {
  const d = new Date(`${date}T23:59:59`);
  return d.toISOString();
}

export function ExpenseForm({
  communityId,
  cycleRevision,
  members,
  categories,
  expenseId,
  initial,
}: ExpenseFormProps) {
  const router = useRouter();
  const isEdit = Boolean(expenseId);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [categoryMode, setCategoryMode] = useState<"reuse" | "onetime">(() => {
    if (initial?.isOneTimeCategory) return "onetime";
    if (initial?.categoryId || categories.length > 0) return "reuse";
    return "onetime";
  });
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categories[0]?.id ?? "",
  );
  const [categoryLabel, setCategoryLabel] = useState(
    initial?.isOneTimeCategory ? (initial.categoryLabel ?? "") : "",
  );
  const [fixedHkd, setFixedHkd] = useState(
    initial ? centsToHkdInput(initial.fixedCents) : "0",
  );
  const [includeVariable, setIncludeVariable] = useState(
    (initial?.variableCents ?? 0) > 0,
  );
  const [variableHkd, setVariableHkd] = useState(
    initial && initial.variableCents > 0
      ? centsToHkdInput(initial.variableCents)
      : "0",
  );
  const [usageLabel, setUsageLabel] = useState(
    initial?.usageLabel ?? "Usage units",
  );
  const [dueDate, setDueDate] = useState(() => {
    if (!initial?.dueAt) return "";
    return initial.dueAt.slice(0, 10);
  });
  const [frontedByMembershipId, setFrontedByMembershipId] = useState(
    initial?.frontedByMembershipId ?? "",
  );
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    const selectedIds = initial
      ? new Set(initial.participants.map((p) => p.membershipId))
      : null;
    for (const m of members) {
      init[m.id] = selectedIds ? selectedIds.has(m.id) : true;
    }
    return init;
  });
  const [usageUnits, setUsageUnits] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    const byId = new Map(
      (initial?.participants ?? []).map((p) => [p.membershipId, p.usageUnits]),
    );
    for (const m of members) {
      init[m.id] = String(byId.get(m.id) ?? 0);
    }
    return init;
  });
  const [previewRows, setPreviewRows] = useState<AllocationPreviewRow[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [previewPending, setPreviewPending] = useState(false);

  const participants = useMemo(() => {
    return members
      .filter((m) => selected[m.id])
      .map((m) => ({
        membershipId: m.id,
        usageUnits: includeVariable
          ? Math.max(0, Math.floor(Number(usageUnits[m.id] || "0")) || 0)
          : 0,
      }));
  }, [members, selected, usageUnits, includeVariable]);

  const buildPayload = useCallback(
    (previewOnly: boolean) => {
      const fixedCents = parseHkdToCents(fixedHkd);
      const variableCents = includeVariable
        ? parseHkdToCents(variableHkd)
        : 0;
      if (fixedCents === null || variableCents === null) {
        throw new Error("Enter valid HKD amounts with up to 2 decimal places.");
      }
      if (includeVariable && variableCents <= 0) {
        throw new Error("Enter a variable amount greater than zero, or remove it.");
      }
      if (includeVariable && !usageLabel.trim()) {
        throw new Error("Enter a usage label for the variable amount.");
      }
      if (!dueDate) {
        throw new Error("A due date is required.");
      }
      if (participants.length === 0) {
        throw new Error("Select at least one participant.");
      }
      const isOneTime = categoryMode === "onetime";
      return {
        title,
        categoryId: isOneTime ? null : categoryId || null,
        categoryLabel: isOneTime ? categoryLabel : "",
        isOneTimeCategory: isOneTime,
        fixedCents,
        variableCents,
        usageLabel: includeVariable ? usageLabel.trim() : "Usage units",
        dueAt: dueAtIsoFromDateInput(dueDate),
        frontedByMembershipId: frontedByMembershipId || null,
        participants,
        cycleRevision,
        previewOnly,
      };
    },
    [
      title,
      categoryMode,
      categoryId,
      categoryLabel,
      fixedHkd,
      includeVariable,
      variableHkd,
      usageLabel,
      dueDate,
      frontedByMembershipId,
      participants,
      cycleRevision,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const payload = buildPayload(true);
        if (payload.fixedCents + payload.variableCents <= 0) {
          if (!cancelled) {
            setPreviewRows([]);
            setPreviewWarnings([]);
            setPreviewError(null);
          }
          return;
        }
        setPreviewPending(true);
        const response = await fetch(
          `/api/communities/${communityId}/expenses`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const data = (await response.json()) as {
          preview?: {
            rows: AllocationPreviewRow[];
            warnings?: string[];
          };
          error?: { message?: string };
        };
        if (cancelled) return;
        if (!response.ok || !data.preview) {
          setPreviewError(data.error?.message ?? "Could not preview allocation.");
          setPreviewRows([]);
          return;
        }
        setPreviewError(null);
        setPreviewRows(data.preview.rows);
        setPreviewWarnings(data.preview.warnings ?? []);
      } catch (err) {
        if (!cancelled) {
          setPreviewError(
            err instanceof Error ? err.message : "Could not preview allocation.",
          );
          setPreviewRows([]);
        }
      } finally {
        if (!cancelled) setPreviewPending(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [buildPayload, communityId]);

  function enableVariable() {
    setIncludeVariable(true);
    if (variableHkd === "0") setVariableHkd("");
  }

  function removeVariable() {
    setIncludeVariable(false);
    setVariableHkd("0");
    setUsageLabel("Usage units");
    setUsageUnits(() => {
      const init: Record<string, string> = {};
      for (const m of members) init[m.id] = "0";
      return init;
    });
  }

  return (
    <form
      className="card-surface space-y-5 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const payload = buildPayload(false);
            const url = expenseId
              ? `/api/communities/${communityId}/expenses/${expenseId}`
              : `/api/communities/${communityId}/expenses`;
            const response = await fetch(url, {
              method: expenseId ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = (await response.json()) as {
              expense?: { id: string };
              error?: { message?: string };
            };
            if (!response.ok || !data.expense) {
              setError(
                data.error?.message ??
                  (expenseId
                    ? "Could not update draft expense."
                    : "Could not save draft expense."),
              );
              return;
            }
            router.push(
              `/communities/${communityId}/expenses/${data.expense.id}`,
            );
            router.refresh();
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : expenseId
                  ? "Could not update draft expense."
                  : "Could not save draft expense.",
            );
          }
        });
      }}
    >
      <div className="space-y-2">
        <label htmlFor="expense-title" className="type-caption font-semibold text-ink">
          Title
        </label>
        <input
          id="expense-title"
          required
          minLength={2}
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink"
          placeholder="Team dinner"
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="type-caption font-semibold text-ink">Category</legend>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="category-mode"
              checked={categoryMode === "reuse"}
              onChange={() => setCategoryMode("reuse")}
              disabled={categories.length === 0}
              className="focus-ring"
            />
            Reusable category
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="category-mode"
              checked={categoryMode === "onetime"}
              onChange={() => setCategoryMode("onetime")}
              className="focus-ring"
            />
            One-time label
          </label>
        </div>
        {categoryMode === "reuse" ? (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            required
            maxLength={60}
            value={categoryLabel}
            onChange={(e) => setCategoryLabel(e.target.value)}
            className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink"
            placeholder="One-time category label"
          />
        )}
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="fixed-hkd" className="type-caption font-semibold text-ink">
          Amount (HKD) — split equally
        </label>
        <input
          id="fixed-hkd"
          inputMode="decimal"
          value={fixedHkd}
          onChange={(e) => setFixedHkd(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 font-mono text-sm text-ink sm:max-w-xs"
          placeholder="0.00"
        />
        <p className="type-caption">
          Expenses start as fixed equal shares. Add a variable portion only when
          some of the cost should follow usage.
        </p>
      </div>

      {!includeVariable ? (
        <button
          type="button"
          onClick={enableVariable}
          className="focus-ring flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-left transition hover:border-primary hover:bg-primary/10"
        >
          <span>
            <span className="block text-sm font-semibold text-primary">
              Add variable amount
            </span>
            <span className="type-caption text-muted">
              Usage-based share with a label and per-person units
            </span>
          </span>
          <span className="text-lg font-bold text-primary" aria-hidden="true">
            +
          </span>
        </button>
      ) : (
        <section
          aria-labelledby="variable-amount-heading"
          className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="variable-amount-heading" className="text-sm font-semibold text-ink">
                Variable amount
              </h3>
              <p className="type-caption mt-0.5">
                Split in proportion to each participant’s usage units.
              </p>
            </div>
            <button
              type="button"
              onClick={removeVariable}
              className="focus-ring rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-danger hover:text-danger"
            >
              Remove
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="variable-hkd"
                className="type-caption font-semibold text-ink"
              >
                Variable amount (HKD)
              </label>
              <input
                id="variable-hkd"
                inputMode="decimal"
                required
                value={variableHkd}
                onChange={(e) => setVariableHkd(e.target.value)}
                className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 font-mono text-sm text-ink"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="usage-label"
                className="type-caption font-semibold text-ink"
              >
                Usage label
              </label>
              <input
                id="usage-label"
                required
                value={usageLabel}
                onChange={(e) => setUsageLabel(e.target.value)}
                className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink"
                placeholder="Sessions attended"
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="type-caption font-semibold text-ink">
              Participant usage ({usageLabel.trim() || "units"})
            </legend>
            <ul className="divide-y divide-border rounded-xl border border-border bg-canvas">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <span
                    className={`text-sm font-medium ${
                      selected[member.id] ? "text-ink" : "text-muted"
                    }`}
                  >
                    {member.displayName}
                    {!selected[member.id] ? (
                      <span className="type-caption ml-2">(not participating)</span>
                    ) : null}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={!selected[member.id]}
                    value={usageUnits[member.id] ?? "0"}
                    onChange={(e) =>
                      setUsageUnits((prev) => ({
                        ...prev,
                        [member.id]: e.target.value,
                      }))
                    }
                    aria-label={`${usageLabel || "Usage"} for ${member.displayName}`}
                    className="focus-ring w-24 rounded-lg border border-border bg-surface px-2 py-1.5 font-mono text-sm disabled:opacity-50"
                  />
                </li>
              ))}
            </ul>
          </fieldset>
        </section>
      )}

      <div className="space-y-2">
        <label htmlFor="due-at" className="type-caption font-semibold text-ink">
          Due date
        </label>
        <input
          id="due-at"
          type="date"
          required
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink sm:max-w-xs"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="fronted-by" className="type-caption font-semibold text-ink">
          Fronted by (optional)
        </label>
        <select
          id="fronted-by"
          value={frontedByMembershipId}
          onChange={(e) => setFrontedByMembershipId(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink sm:max-w-xs"
        >
          <option value="">Not fronted — supplier paid from pool later</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </select>
        <p className="type-caption">
          If a member paid the supplier, they can be reimbursed from treasurer
          cash after the expense is committed.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="type-caption font-semibold text-ink">
          Participants
        </legend>
        <ul className="divide-y divide-border rounded-xl border border-border bg-canvas">
          {members.map((member) => (
            <li key={member.id} className="px-4 py-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={!!selected[member.id]}
                  onChange={(e) =>
                    setSelected((prev) => ({
                      ...prev,
                      [member.id]: e.target.checked,
                    }))
                  }
                  className="focus-ring"
                />
                {member.displayName}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <section className="space-y-3" aria-labelledby="live-preview-heading">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="live-preview-heading" className="type-h3">
            Live allocation preview
          </h3>
          {previewPending ? (
            <span className="type-caption">Updating…</span>
          ) : null}
        </div>
        {previewError ? <ErrorAlert message={previewError} /> : null}
        {previewWarnings.length > 0 ? (
          <p className="rounded-md border border-warning/30 bg-warning-bg px-3 py-2 text-sm text-warning">
            {previewWarnings.join(" · ")}
          </p>
        ) : null}
        <AllocationPreviewTable rows={previewRows} />
      </section>

      {error ? <ErrorAlert message={error} /> : null}

      <button
        type="submit"
        disabled={pending}
        className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : isEdit ? "Save changes" : "Save draft"}
      </button>
    </form>
  );
}
