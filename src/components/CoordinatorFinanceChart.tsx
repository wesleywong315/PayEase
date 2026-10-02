"use client";

import { useEffect, useMemo, useState } from "react";
import { MoneyText } from "@/components/MoneyText";
import { formatHkdFromCents } from "@/lib/money";

export type FinanceBreakdownLine = {
  id: string;
  label: string;
  detail?: string;
  amountCents: number;
};

export type FinanceBarSeries = {
  id: "committed" | "fundingIn" | "treasurerCash";
  label: string;
  totalCents: number;
  color: string;
  breakdown: FinanceBreakdownLine[];
};

type Props = {
  series: FinanceBarSeries[];
};

const BAR_MAX_PX = 140;

export function CoordinatorFinanceChart({ series }: Props) {
  const [selectedId, setSelectedId] = useState<FinanceBarSeries["id"] | null>(
    null,
  );
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const maxCents = useMemo(() => {
    const peak = Math.max(0, ...series.map((s) => Math.abs(s.totalCents)));
    return peak > 0 ? peak : 1;
  }, [series]);

  const selected = series.find((s) => s.id === selectedId) ?? null;

  return (
    <section
      aria-labelledby="finance-chart-heading"
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="finance-chart-heading"
          className="text-base font-semibold text-ink"
        >
          Cycle finances
        </h2>
        <p className="type-caption">Tap a bar for breakdown</p>
      </div>

      <div
        className="grid grid-cols-4 items-end gap-2 sm:gap-4"
        style={{ height: BAR_MAX_PX + 56 }}
        role="list"
      >
        {series.map((bar) => {
          const heightPx = animated
            ? Math.max(
                bar.totalCents === 0 ? 2 : 8,
                Math.round((Math.abs(bar.totalCents) / maxCents) * BAR_MAX_PX),
              )
            : 0;
          const isOpen = selectedId === bar.id;

          return (
            <button
              key={bar.id}
              type="button"
              role="listitem"
              aria-pressed={isOpen}
              aria-label={`${bar.label}: ${formatHkdFromCents(Math.max(0, bar.totalCents))}`}
              onClick={() =>
                setSelectedId((prev) => (prev === bar.id ? null : bar.id))
              }
              className={`focus-ring group flex h-full flex-col items-center justify-end gap-2 rounded-lg px-1 py-1 transition ${
                isOpen ? "bg-canvas/80" : "hover:bg-canvas/50"
              }`}
            >
              <span
                className={`type-caption text-center font-semibold tabular-nums transition-opacity ${
                  isOpen ? "text-ink" : "text-muted"
                }`}
              >
                {formatHkdFromCents(Math.max(0, bar.totalCents))}
              </span>
              <span
                className="w-full max-w-[3.25rem] rounded-t-md transition-[height,transform] duration-500 ease-out sm:max-w-[4rem]"
                style={{
                  height: heightPx,
                  backgroundColor: bar.color,
                  transform: isOpen ? "scaleX(1.08)" : "scaleX(1)",
                  boxShadow: isOpen
                    ? `0 0 0 2px color-mix(in srgb, ${bar.color} 35%, transparent)`
                    : undefined,
                }}
                aria-hidden="true"
              />
              <span className="type-caption max-w-full text-center leading-tight text-muted">
                {bar.label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          selected ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          {selected ? (
            <div
              className="mt-1 space-y-2 rounded-lg border border-border bg-canvas/70 px-3 py-3"
              style={{ borderLeftWidth: 4, borderLeftColor: selected.color }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{selected.label}</p>
                <MoneyText
                  cents={Math.max(0, selected.totalCents)}
                  className="font-semibold"
                />
              </div>
              {selected.breakdown.length === 0 ? (
                <p className="type-caption">No line items yet.</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border bg-surface">
                  {selected.breakdown.map((line) => (
                    <li
                      key={line.id}
                      className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {line.label}
                        </p>
                        {line.detail ? (
                          <p className="type-caption truncate">{line.detail}</p>
                        ) : null}
                      </div>
                      <MoneyText
                        cents={Math.max(0, line.amountCents)}
                        className="shrink-0 font-medium"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
