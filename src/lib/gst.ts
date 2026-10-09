/**
 * Money and GST maths for New Zealand invoices.
 *
 * Design rules:
 * - All money is an integer number of cents. Floats never hold money.
 * - Quantities may be fractional (e.g. 1.5 hours) and are fixed to 3 dp
 *   (thousandths) before any arithmetic.
 * - Rounding is "half away from zero" to the nearest cent, applied once
 *   per line and once for the GST on the invoice total.
 * - GST is calculated on the invoice total rather than per line, so the
 *   GST shown always equals 15% of the GST-exclusive subtotal (or 3/23 of
 *   the GST-inclusive total), with no per-line rounding drift.
 *
 * This module is pure: no I/O, no Date, no locale state beyond formatting.
 */

/** Integer number of cents. */
export type Cents = number;

/** Whether entered unit prices already include GST. */
export type TaxMode = "exclusive" | "inclusive";

/** NZ standard GST rate, in basis points (15.00%). */
export const NZ_GST_RATE_BPS = 1500;

const BPS_DENOMINATOR = 10_000;
const QUANTITY_SCALE = 1000;

export class MoneyError extends Error {
  override name = "MoneyError";
}

function assertCents(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a safe integer number of cents, got ${value}`);
  }
}

/**
 * Integer division rounded half away from zero.
 * Uses only integer operations on safe integers, so it is exact.
 */
export function divRound(numerator: number, denominator: number): number {
  assertCents(numerator, "numerator");
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new MoneyError(`denominator must be a positive integer, got ${denominator}`);
  }
  const sign = numerator < 0 ? -1 : 1;
  const abs = Math.abs(numerator);
  const quotient = Math.floor(abs / denominator);
  const remainder = abs - quotient * denominator;
  const rounded = remainder * 2 >= denominator ? quotient + 1 : quotient;
  return rounded === 0 ? 0 : sign * rounded;
}

/**
 * Parse a user-entered dollar amount ("1,234.50", "$99", "-12.3") into cents.
 * Rejects more than two decimal places instead of silently rounding.
 */
export function parseDollars(input: string): Cents {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) {
    throw new MoneyError(`"${input}" is not a valid dollar amount`);
  }
  const [, negative, whole = "0", fraction = ""] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  assertCents(cents);
  return negative && cents !== 0 ? -cents : cents;
}

/** Convert a quantity to integer thousandths, rejecting more than 3 dp. */
export function toQuantityThousandths(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new MoneyError(`quantity must be a non-negative number, got ${quantity}`);
  }
  const scaled = Math.round(quantity * QUANTITY_SCALE);
  if (Math.abs(scaled - quantity * QUANTITY_SCALE) > 1e-6) {
    throw new MoneyError(`quantity supports at most 3 decimal places, got ${quantity}`);
  }
  return scaled;
}

/** quantity x unit price, rounded to the nearest cent. */
export function lineAmount(quantity: number, unitPriceCents: Cents): Cents {
  assertCents(unitPriceCents, "unit price");
  return divRound(toQuantityThousandths(quantity) * unitPriceCents, QUANTITY_SCALE);
}

/** GST to add on top of a GST-exclusive amount. */
export function gstOnExclusive(amountCents: Cents, rateBps = NZ_GST_RATE_BPS): Cents {
  assertCents(amountCents);
  return divRound(amountCents * rateBps, BPS_DENOMINATOR);
}

/**
 * GST contained in a GST-inclusive amount.
 * At 15% this is the familiar 3/23 fraction: amount * 1500 / 11500.
 */
export function gstInInclusive(amountCents: Cents, rateBps = NZ_GST_RATE_BPS): Cents {
  assertCents(amountCents);
  return divRound(amountCents * rateBps, BPS_DENOMINATOR + rateBps);
}

/** Add GST to an exclusive amount. */
export function addGst(exclusiveCents: Cents, rateBps = NZ_GST_RATE_BPS): Cents {
  return exclusiveCents + gstOnExclusive(exclusiveCents, rateBps);
}

/** Strip GST from an inclusive amount. */
export function removeGst(inclusiveCents: Cents, rateBps = NZ_GST_RATE_BPS): Cents {
  return inclusiveCents - gstInInclusive(inclusiveCents, rateBps);
}

export interface LineInput {
  quantity: number;
  unitPriceCents: Cents;
}

export interface InvoiceTotals {
  /** Each line's quantity x unit price, in the invoice's tax mode. */
  lineAmounts: Cents[];
  /** Total excluding GST. */
  subtotalCents: Cents;
  gstCents: Cents;
  /** Total including GST: what the client pays. */
  totalCents: Cents;
}

/**
 * Compute invoice totals.
 *
 * In "exclusive" mode unit prices exclude GST and GST is added on top.
 * In "inclusive" mode unit prices include GST and GST is extracted from
 * the total. Either way subtotal + gst === total, exactly.
 */
export function calculateInvoice(
  lines: readonly LineInput[],
  mode: TaxMode,
  rateBps = NZ_GST_RATE_BPS,
): InvoiceTotals {
  const lineAmounts = lines.map((line) => lineAmount(line.quantity, line.unitPriceCents));
  const sum = lineAmounts.reduce((acc, amount) => acc + amount, 0);
  assertCents(sum, "line sum");

  if (mode === "exclusive") {
    const gstCents = gstOnExclusive(sum, rateBps);
    return { lineAmounts, subtotalCents: sum, gstCents, totalCents: sum + gstCents };
  }

  const gstCents = gstInInclusive(sum, rateBps);
  return { lineAmounts, subtotalCents: sum - gstCents, gstCents, totalCents: sum };
}

const nzdFormatter = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format cents as NZD, e.g. 123456 -> "$1,234.56". */
export function formatNZD(cents: Cents): string {
  assertCents(cents);
  // Dividing by 100 for display only; the result is never fed back into maths.
  return nzdFormatter.format(cents / 100);
}

/** Format cents as a plain decimal string for form inputs, e.g. 1050 -> "10.50". */
export function centsToDecimalString(cents: Cents): string {
  assertCents(cents);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
