export type CategorySlice = {
  key: string;
  label: string;
  totalCents: number;
};

export function buildDonutPath(
  slices: CategorySlice[],
  size = 200,
  stroke = 28,
): Array<{ key: string; label: string; totalCents: number; d: string; color: string }> {
  const total = slices.reduce((s, x) => s + x.totalCents, 0);
  if (total <= 0) return [];

  const colors = [
    "#1f5a45",
    "#3f8068",
    "#b88a5a",
    "#2b5a43",
    "#8a5a12",
    "#9b2c2c",
    "#5a7a6a",
  ];

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  let angle = -Math.PI / 2;
  const out: Array<{
    key: string;
    label: string;
    totalCents: number;
    d: string;
    color: string;
  }> = [];

  slices.forEach((slice, i) => {
    const sweep = (slice.totalCents / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;

    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;

    out.push({
      key: slice.key,
      label: slice.label,
      totalCents: slice.totalCents,
      d,
      color: colors[i % colors.length]!,
    });
  });

  return out;
}
