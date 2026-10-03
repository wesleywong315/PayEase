"use client";

import { MoneyText } from "@/components/MoneyText";

export type ProfileArcMetric = {
  id: "payments" | "reimbursements";
  label: string;
  completedCents: number;
  remainingCents: number;
  totalCents: number;
  percent: number;
  color: string;
};

type Props = {
  metrics: ProfileArcMetric[];
};

/** Semi-circle gauge: track + progress arc, percent filled by amount settled. */
function SemiCircleArc({
  percent,
  color,
  label,
}: {
  percent: number;
  color: string;
  label: string;
}) {
  const size = 160;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // Semi-circle from left (-180°) to right (0°) through the top
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;
  const trackPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;
  const circumference = Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * circumference;

  return (
    <svg
      width={size}
      height={size / 2 + stroke}
      viewBox={`0 0 ${size} ${size / 2 + stroke}`}
      role="img"
      aria-label={`${label}: ${clamped}% settled`}
      className="mx-auto overflow-visible"
    >
      <path
        d={trackPath}
        fill="none"
        stroke="var(--payease-border)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path
        d={trackPath}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        className="transition-[stroke-dasharray] duration-700 ease-out"
      />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        className="fill-ink text-2xl font-semibold"
        style={{ fontSize: 28, fontWeight: 650 }}
      >
        {clamped}%
      </text>
    </svg>
  );
}

export function ProfileFinanceArcs({ metrics }: Props) {
  return (
    <ul className="grid gap-4">
      {metrics.map((metric) => (
        <li
          key={metric.id}
          className="rounded-xl border border-border bg-surface px-3 py-4 text-center"
        >
          <p className="text-sm font-semibold text-ink">{metric.label}</p>
          <div className="mt-3">
            <SemiCircleArc
              percent={metric.percent}
              color={metric.color}
              label={metric.label}
            />
          </div>
          <div className="mt-2 space-y-1">
            <p className="type-caption">
              Settled{" "}
              <MoneyText
                cents={metric.completedCents}
                className="inline font-semibold text-ink"
              />
            </p>
            <p className="type-caption">
              Remaining{" "}
              <MoneyText
                cents={metric.remainingCents}
                className={`inline font-semibold ${
                  metric.remainingCents > 0 ? "text-danger" : "text-muted"
                }`}
              />
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
