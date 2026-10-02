import { MoneyText } from "@/components/MoneyText";

export type DonutSegment = {
  key: string;
  label: string;
  totalCents: number;
  d: string;
  color: string;
};

type CategoryDonutProps = {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  caption?: string;
};

export function CategoryDonut({
  segments,
  size = 200,
  stroke = 28,
  caption = "Committed expenses by category",
}: CategoryDonutProps) {
  const total = segments.reduce((sum, s) => sum + s.totalCents, 0);

  if (segments.length === 0 || total <= 0) {
    return (
      <p className="type-caption rounded-xl border border-dashed border-border px-4 py-8 text-center">
        No committed expenses to chart yet.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
      <figure className="mx-auto">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-labelledby="category-donut-title category-donut-desc"
        >
          <title id="category-donut-title">{caption}</title>
          <desc id="category-donut-desc">
            Donut chart of committed expense totals by category. A data table
            follows with the same values.
          </desc>
          {segments.map((seg) => (
            <path
              key={seg.key}
              d={seg.d}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
            >
              <title>
                {seg.label}: {(seg.totalCents / 100).toFixed(2)} HKD
              </title>
            </path>
          ))}
        </svg>
      </figure>

      <div className="overflow-x-auto border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">{caption} data table</caption>
          <thead className="border-b border-border bg-background text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Category
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Total
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg) => {
              const pct = Math.round((seg.totalCents / total) * 1000) / 10;
              return (
                <tr key={seg.key} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium text-foreground">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: seg.color }}
                        aria-hidden="true"
                      />
                      {seg.label}
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <MoneyText
                      cents={seg.totalCents}
                      label={`${seg.label} total`}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-background">
              <th scope="row" className="px-4 py-3 font-semibold">
                Total
              </th>
              <td className="px-4 py-3 font-semibold" colSpan={2}>
                <MoneyText cents={total} label="Category total" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
