import { describe, expect, it } from "vitest";
import { addDays, formatDate, todayInNZ } from "./dates";

describe("todayInNZ", () => {
  it("uses the New Zealand calendar date, not UTC", () => {
    // 11:30 UTC on 1 March is 00:30 on 2 March in Auckland (NZDT, UTC+13).
    expect(todayInNZ(new Date("2026-03-01T11:30:00Z"))).toBe("2026-03-02");
    // 11:30 UTC on 1 July is 23:30 on 1 July in Auckland (NZST, UTC+12).
    expect(todayInNZ(new Date("2026-07-01T11:30:00Z"))).toBe("2026-07-01");
  });
});

describe("addDays", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-20", 20)).toBe("2027-01-09");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("throws on an invalid date", () => {
    expect(() => addDays("not-a-date", 1)).toThrow(RangeError);
  });
});

describe("formatDate", () => {
  it("formats for NZ readers", () => {
    expect(formatDate("2026-03-01")).toBe("1 Mar 2026");
  });
});
