import { prisma } from "@/lib/db";
import type { CategorySlice } from "@/lib/report-chart";

export type { CategorySlice };

/**
 * Committed expense totals by category. One-time labels roll into a single slice.
 */
export async function getCategoryReportSlices(input: {
  communityId: string;
  cycleId: string;
}): Promise<CategorySlice[]> {
  const expenses = await prisma.expense.findMany({
    where: {
      communityId: input.communityId,
      cycleId: input.cycleId,
      status: "COMMITTED",
    },
    select: {
      category: true,
      categoryId: true,
      isOneTimeCategory: true,
      totalCents: true,
    },
  });

  const map = new Map<string, CategorySlice>();
  for (const e of expenses) {
    const key = e.isOneTimeCategory
      ? "__one_time__"
      : e.categoryId
        ? `cat:${e.categoryId}`
        : `label:${e.category}`;
    const label = e.isOneTimeCategory ? "One-time expenses" : e.category;
    const existing = map.get(key) ?? { key, label, totalCents: 0 };
    existing.totalCents += e.totalCents;
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.totalCents - a.totalCents);
}
