import { MoneyText } from "@/components/MoneyText";

export type AllocationPreviewRow = {
  membershipId: string;
  name: string;
  fixedCents: number;
  usageCents: number;
  baselineCents: number;
};

type AllocationPreviewTableProps = {
  rows: AllocationPreviewRow[];
  caption?: string;
};

export function AllocationPreviewTable({
  rows,
  caption = "Allocation preview",
}: AllocationPreviewTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">No allocation rows to display.</p>
    );
  }

  return (
    <div className="overflow-x-auto border border-border bg-surface">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-background text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Member
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Fixed share
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Usage share
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Baseline
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.membershipId} className="border-b border-border last:border-0">
              <th scope="row" className="px-4 py-3 font-medium text-foreground">
                {row.name}
              </th>
              <td className="px-4 py-3">
                <MoneyText cents={row.fixedCents} label={`${row.name} fixed share`} />
              </td>
              <td className="px-4 py-3">
                <MoneyText cents={row.usageCents} label={`${row.name} usage share`} />
              </td>
              <td className="px-4 py-3 font-semibold">
                <MoneyText cents={row.baselineCents} label={`${row.name} baseline`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
