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

/**
 * Parse a HKD dollar string (e.g. "12.5") into integer cents.
 * Returns null when the input is empty or not a valid money amount.
 */
export function parseHkdToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [dollarsPart, centsPart = ""] = trimmed.split(".");
  const dollars = Number(dollarsPart);
  if (!Number.isSafeInteger(dollars) || dollars < 0) return null;
  const centsDigits = centsPart.padEnd(2, "0").slice(0, 2);
  const cents = centsDigits === "" ? 0 : Number(centsDigits);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 99) return null;
  return dollars * 100 + cents;
}
