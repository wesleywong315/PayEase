import type { ReactNode } from "react";

type StatItem = {
  label: string;
  value: ReactNode;
  hint?: string;
};

type StatGridProps = {
  items: StatItem[];
  className?: string;
};

export function StatGrid({ items, className = "" }: StatGridProps) {
  return (
    <dl
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="border border-border bg-surface px-4 py-4"
        >
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {item.value}
          </dd>
          {item.hint ? (
            <p className="mt-1 text-xs text-muted">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
