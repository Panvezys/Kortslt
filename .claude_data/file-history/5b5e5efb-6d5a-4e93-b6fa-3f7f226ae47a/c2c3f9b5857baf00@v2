// Money helpers for fields stored as integer cents.
//
// The DB layer (coaches.pricePerHour, Stripe amounts) uses integer cents to
// avoid floating-point drift in financial math. UI surfaces use these helpers
// so euros↔cents conversion stays consistent and round-trips don't lose
// precision.

/** Format integer cents as a euro string, e.g. 2550 → "25,50". */
export function centsToEuroString(cents: number | null | undefined, locale: string = "lt-LT"): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return (cents / 100).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format integer cents as a "25,50 €/val" string suitable for coach price labels. */
export function centsToEuroLabel(cents: number | null | undefined): string {
  if (cents == null) return "";
  return `${centsToEuroString(cents)} €`;
}

/** Convert a user-typed euro string (e.g. "25,50" or "25.5") to integer cents.
 *  Returns null for empty or invalid input. */
export function euroStringToCents(input: string | null | undefined): number | null {
  if (!input) return null;
  const normalized = input.replace(",", ".").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
