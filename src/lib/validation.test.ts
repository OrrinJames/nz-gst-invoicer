import { describe, expect, it } from "vitest";
import { clientSchema, invoiceSchema, lineItemSchema, toFieldErrors } from "./validation";

const validInvoice = {
  clientId: "6f1c3c1e-8a4b-4d2e-9f3a-1b2c3d4e5f60",
  taxMode: "exclusive",
  issueDate: "2026-03-01",
  dueDate: "2026-03-20",
  notes: "",
  items: [{ description: "Website build", quantity: "12.5", unitPrice: "120.00" }],
};

describe("clientSchema", () => {
  it("trims fields and turns blanks into null", () => {
    const parsed = clientSchema.parse({
      name: "  Kiwi Widgets Ltd ",
      email: "",
      address: "  ",
      gst_number: "",
    });
    expect(parsed).toEqual({ name: "Kiwi Widgets Ltd", email: null, address: null, gst_number: null });
  });

  it("accepts NZ GST number formats", () => {
    expect(clientSchema.safeParse({ name: "A", gst_number: "123-456-789" }).success).toBe(true);
    expect(clientSchema.safeParse({ name: "A", gst_number: "12-345-678" }).success).toBe(true);
    expect(clientSchema.safeParse({ name: "A", gst_number: "123456789" }).success).toBe(true);
  });

  it("rejects malformed GST numbers and emails", () => {
    const result = clientSchema.safeParse({ name: "A", gst_number: "1234", email: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(errors.gst_number).toMatch(/GST number/);
      expect(errors.email).toMatch(/email/);
    }
  });

  it("requires a name", () => {
    expect(clientSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("lineItemSchema", () => {
  it("converts the unit price to integer cents", () => {
    const parsed = lineItemSchema.parse({ description: "Hosting", quantity: "1", unitPrice: "$1,200.50" });
    expect(parsed).toStrictEqual({ description: "Hosting", quantity: 1, unitPriceCents: 120050 });
  });

  it("rejects prices with fractional cents", () => {
    const result = lineItemSchema.safeParse({ description: "x", quantity: "1", unitPrice: "1.999" });
    expect(result.success).toBe(false);
  });

  it("rejects zero, negative, or over-precise quantities", () => {
    for (const quantity of ["0", "-1", "1.0005", "abc"]) {
      expect(lineItemSchema.safeParse({ description: "x", quantity, unitPrice: "1" }).success).toBe(false);
    }
  });
});

describe("invoiceSchema", () => {
  it("parses a valid invoice", () => {
    const parsed = invoiceSchema.parse(validInvoice);
    expect(parsed.items[0]).toStrictEqual({ description: "Website build", quantity: 12.5, unitPriceCents: 12000 });
    expect(parsed.notes).toBeNull();
  });

  it("requires at least one line item", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a due date before the issue date", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, dueDate: "2026-02-28" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).dueDate).toMatch(/before the issue date/);
    }
  });

  it("reports nested line item errors by path", () => {
    const result = invoiceSchema.safeParse({
      ...validInvoice,
      items: [{ description: "", quantity: "1", unitPrice: "10" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error)["items.0.description"]).toBe("Description is required");
    }
  });
});
