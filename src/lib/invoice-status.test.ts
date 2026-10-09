import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition, isOverdue } from "./invoice-status";

describe("invoice status transitions", () => {
  it("lets a draft be sent or voided", () => {
    expect(allowedTransitions("draft")).toEqual(["sent", "void"]);
  });

  it("lets a sent invoice be paid or voided", () => {
    expect(canTransition("sent", "paid")).toBe(true);
    expect(canTransition("sent", "void")).toBe(true);
    expect(canTransition("sent", "draft")).toBe(false);
  });

  it("treats paid and void as final", () => {
    expect(allowedTransitions("paid")).toEqual([]);
    expect(allowedTransitions("void")).toEqual([]);
    expect(canTransition("paid", "void")).toBe(false);
  });

  it("cannot skip straight from draft to paid", () => {
    expect(canTransition("draft", "paid")).toBe(false);
  });
});

describe("isOverdue", () => {
  it("is overdue only when sent and past due", () => {
    expect(isOverdue("sent", "2026-01-31", "2026-02-01")).toBe(true);
    expect(isOverdue("sent", "2026-02-01", "2026-02-01")).toBe(false);
    expect(isOverdue("paid", "2026-01-31", "2026-02-01")).toBe(false);
    expect(isOverdue("draft", "2026-01-31", "2026-02-01")).toBe(false);
  });
});
