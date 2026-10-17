// NFR-01, D-02: money is integer cents. TypeScript never adds or divides
// amounts; it only converts typed text to cents and cents to text, using
// string and BigInt operations so no float is ever involved.

const MONEY_RE = /^(\d{1,3}(,\d{3})+|\d+)(\.(\d{1,2}))?$/;

/** "1,200.50" → 120050. Returns null for anything that isn't a positive-or-zero amount with at most 2 decimals. */
export function parseMoney(input: string | null | undefined): number | null {
  const text = String(input ?? "").trim().replace(/^\$/, "").trim();
  const m = MONEY_RE.exec(text);
  if (!m) return null;
  const whole = m[1].replaceAll(",", "");
  const frac = (m[4] ?? "").padEnd(2, "0");
  const cents = BigInt(whole) * 100n + BigInt(frac);
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(cents);
}

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "USD";

/**
 * 120000 → "$1,200.00". With currency null, a plain decimal ("1200.00") for CSV.
 * Intl formats the decimal string exactly; no division happens in floating point.
 */
export function formatMoney(cents: number | bigint | string | null | undefined, currency: string | null = CURRENCY): string {
  const value = BigInt(cents ?? 0);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const decimal = `${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
  if (currency === null) return `${negative ? "-" : ""}${decimal}`;
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    decimal as unknown as number, // Intl accepts exact decimal strings (NumberFormat v3)
  );
  return negative ? `-${formatted}` : formatted;
}

/** 120000 → "1200.00": the value for an <input> the landlord can edit. */
export function centsToInput(cents: number | null | undefined): string {
  return cents == null ? "" : formatMoney(cents, null);
}
