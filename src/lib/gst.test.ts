import { describe, expect, it } from "vitest";
import {
  MoneyError,
  addGst,
  calculateInvoice,
  centsToDecimalString,
  divRound,
  formatNZD,
  gstInInclusive,
  gstOnExclusive,
  lineAmount,
  parseDollars,
  removeGst,
  toQuantityThousandths,
} from "./gst";

describe("divRound", () => {
  it("rounds half away from zero", () => {
    expect(divRound(5, 10)).toBe(1);
    expect(divRound(4, 10)).toBe(0);
    expect(divRound(15, 10)).toBe(2);
    expect(divRound(-5, 10)).toBe(-1);
    expect(divRound(-4, 10)).toBe(0);
  });

  it("never returns negative zero", () => {
    expect(Object.is(divRound(-1, 10), 0)).toBe(true);
  });

  it("rejects non-integer or non-positive denominators", () => {
    expect(() => divRound(10, 0)).toThrow(MoneyError);
    expect(() => divRound(10, 1.5)).toThrow(MoneyError);
    expect(() => divRound(1.5, 10)).toThrow(MoneyError);
  });
});

describe("parseDollars", () => {
  it.each([
    ["0", 0],
    ["12", 1200],
    ["12.5", 1250],
    ["12.05", 1205],
    ["$1,234.56", 123456],
    [" 99.99 ", 9999],
    ["-10.10", -1010],
    ["-0", 0],
  ])("parses %j as %i cents", (input, expected) => {
    expect(parseDollars(input)).toBe(expected);
  });

  it.each(["", "abc", "1.234", "1.2.3", "--1", "1e3"])("rejects %j", (input) => {
    expect(() => parseDollars(input)).toThrow(MoneyError);
  });
});

describe("toQuantityThousandths", () => {
  it("scales quantities to integer thousandths", () => {
    expect(toQuantityThousandths(1)).toBe(1000);
    expect(toQuantityThousandths(1.5)).toBe(1500);
    expect(toQuantityThousandths(0.125)).toBe(125);
    // Classic float trap: 1.005 * 1000 === 1004.9999999999999
    expect(toQuantityThousandths(1.005)).toBe(1005);
  });

  it("rejects negative, non-finite, or over-precise quantities", () => {
    expect(() => toQuantityThousandths(-1)).toThrow(MoneyError);
    expect(() => toQuantityThousandths(Number.NaN)).toThrow(MoneyError);
    expect(() => toQuantityThousandths(Infinity)).toThrow(MoneyError);
    expect(() => toQuantityThousandths(1.0005)).toThrow(MoneyError);
  });
});

describe("lineAmount", () => {
  it("multiplies quantity by unit price in cents", () => {
    expect(lineAmount(3, 1999)).toBe(5997);
    expect(lineAmount(1.5, 12000)).toBe(18000);
  });

  it("rounds fractional-cent results to the nearest cent", () => {
    // 0.333 h x $100.00 = $33.30
    expect(lineAmount(0.333, 10000)).toBe(3330);
    // 0.125 x $0.10 = 1.25c -> 1c
    expect(lineAmount(0.125, 10)).toBe(1);
    // 0.25 x $0.10 = 2.5c -> 3c (half away from zero)
    expect(lineAmount(0.25, 10)).toBe(3);
  });

  it("supports credit lines with negative prices", () => {
    expect(lineAmount(1, -5000)).toBe(-5000);
    expect(lineAmount(0.25, -10)).toBe(-3);
  });
});

describe("GST helpers (15%)", () => {
  it("calculates GST on a GST-exclusive amount", () => {
    expect(gstOnExclusive(10000)).toBe(1500);
    expect(gstOnExclusive(1)).toBe(0); // 0.15c
    expect(gstOnExclusive(10)).toBe(2); // 1.5c -> 2c
    expect(gstOnExclusive(0)).toBe(0);
  });

  it("extracts GST from a GST-inclusive amount (3/23)", () => {
    expect(gstInInclusive(11500)).toBe(1500);
    expect(gstInInclusive(2300)).toBe(300);
    expect(gstInInclusive(10000)).toBe(1304); // 1304.35c
  });

  it("adds and removes GST", () => {
    expect(addGst(10000)).toBe(11500);
    expect(removeGst(11500)).toBe(10000);
    expect(removeGst(10000)).toBe(8696);
  });

  it("supports a custom rate in basis points", () => {
    expect(gstOnExclusive(10000, 1250)).toBe(1250);
    expect(gstInInclusive(11250, 1250)).toBe(1250);
  });

  it("rejects fractional cents", () => {
    expect(() => gstOnExclusive(10.5)).toThrow(MoneyError);
  });
});

describe("calculateInvoice", () => {
  const lines = [
    { quantity: 10, unitPriceCents: 9500 }, // $950.00
    { quantity: 1.5, unitPriceCents: 3333 }, // $49.995 -> $50.00
    { quantity: 1, unitPriceCents: -2500 }, // discount
  ];

  it("adds GST on top in exclusive mode", () => {
    const totals = calculateInvoice(lines, "exclusive");
    expect(totals.lineAmounts).toEqual([95000, 5000, -2500]);
    expect(totals.subtotalCents).toBe(97500);
    expect(totals.gstCents).toBe(14625);
    expect(totals.totalCents).toBe(112125);
  });

  it("extracts GST in inclusive mode", () => {
    const totals = calculateInvoice(lines, "inclusive");
    expect(totals.totalCents).toBe(97500);
    expect(totals.gstCents).toBe(12717); // 97500 * 3/23 = 12717.39
    expect(totals.subtotalCents).toBe(84783);
  });

  it("returns zeros for an empty invoice", () => {
    expect(calculateInvoice([], "exclusive")).toEqual({
      lineAmounts: [],
      subtotalCents: 0,
      gstCents: 0,
      totalCents: 0,
    });
  });

  it("always satisfies subtotal + gst === total", () => {
    // Deterministic pseudo-random sweep (LCG) so failures are reproducible.
    let seed = 42;
    const next = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed;
    };
    for (let i = 0; i < 500; i++) {
      const generated = Array.from({ length: (next() % 5) + 1 }, () => ({
        quantity: (next() % 10_000) / 1000,
        unitPriceCents: (next() % 2_000_000) - 100_000,
      }));
      for (const mode of ["exclusive", "inclusive"] as const) {
        const t = calculateInvoice(generated, mode);
        expect(t.subtotalCents + t.gstCents).toBe(t.totalCents);
        expect(Number.isInteger(t.gstCents)).toBe(true);
      }
    }
  });
});

describe("formatting", () => {
  it("formats cents as NZD", () => {
    expect(formatNZD(123456)).toBe("$1,234.56");
    expect(formatNZD(5)).toBe("$0.05");
    expect(formatNZD(0)).toBe("$0.00");
  });

  it("formats cents as a decimal input string", () => {
    expect(centsToDecimalString(1050)).toBe("10.50");
    expect(centsToDecimalString(7)).toBe("0.07");
    expect(centsToDecimalString(-1999)).toBe("-19.99");
  });
});
