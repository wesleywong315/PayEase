/**
 * Money helpers for HKD integer cents.
 */

export function assertSafeNonNegativeInt(n: number): asserts n is number {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error(
      `Expected a safe nonnegative integer, got ${String(n)}`,
    );
  }
}

export function assertSafeInt(n: number): asserts n is number {
  if (!Number.isSafeInteger(n)) {
    throw new Error(`Expected a safe integer, got ${String(n)}`);
  }
}

function formatAbsoluteDollars(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const rem = cents % 100;
  const withSeparators = dollars.toLocaleString("en-HK");
  return `${withSeparators}.${String(rem).padStart(2, "0")}`;
}

/** Format cents as "HK$1,200.00" (thousands separators). */
export function formatHkdFromCents(cents: number): string {
  assertSafeNonNegativeInt(cents);
  return `HK$${formatAbsoluteDollars(cents)}`;
}

/** Format signed cents; negative values render as "-HK$1.00". */
export function formatHkdFromCentsSigned(cents: number): string {
  assertSafeInt(cents);
  if (cents < 0) {
    return `-HK$${formatAbsoluteDollars(Math.abs(cents))}`;
  }
  return formatHkdFromCents(cents);
}
