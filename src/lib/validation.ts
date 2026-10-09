import { z } from "zod";
import { MoneyError, parseDollars, toQuantityThousandths } from "./gst";

/** Trim a string; treat blank as null. Useful for optional form fields. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

/** NZ GST numbers are 8 or 9 digits, written 12-345-678 or 123-456-789. */
export const GST_NUMBER_PATTERN = /^\d{2,3}-?\d{3}-?\d{3}$/;

const gstNumber = optionalText(11).refine(
  (value) => value === null || GST_NUMBER_PATTERN.test(value),
  { message: "GST number should look like 123-456-789" },
);

const optionalEmail = optionalText(320).refine(
  (value) => value === null || z.email().safeParse(value).success,
  { message: "Enter a valid email address" },
);

const isoDate = z.iso.date({ message: "Enter a valid date (YYYY-MM-DD)" });

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(200),
  email: optionalEmail,
  address: optionalText(1000),
  gst_number: gstNumber,
});
export type ClientInput = z.infer<typeof clientSchema>;

export const businessProfileSchema = z.object({
  business_name: z.string().trim().min(1, "Business name is required").max(200),
  gst_number: gstNumber,
  email: optionalEmail,
  address: optionalText(1000),
  bank_account: optionalText(40),
});
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(500),
  quantity: z.coerce
    .number({ message: "Quantity must be a number" })
    .positive("Quantity must be greater than zero")
    .max(1_000_000)
    .refine(
      (value) => {
        try {
          toQuantityThousandths(value);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Quantity supports up to 3 decimal places" },
    ),
  unitPrice: z.string().transform((value, ctx) => {
    try {
      return parseDollars(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof MoneyError ? "Enter a price like 120.00" : "Invalid price",
      });
      return z.NEVER;
    }
  }),
})
  // Expose the parsed price under an explicit name so cents are never mistaken for dollars.
  .transform(({ unitPrice, ...rest }) => ({ ...rest, unitPriceCents: unitPrice }));
export type LineItemInput = z.infer<typeof lineItemSchema>;

export const taxModeSchema = z.enum(["exclusive", "inclusive"]);

export const invoiceSchema = z
  .object({
    clientId: z.uuid({ message: "Choose a client" }),
    taxMode: taxModeSchema,
    issueDate: isoDate,
    dueDate: isoDate,
    notes: optionalText(2000),
    items: z.array(lineItemSchema).min(1, "Add at least one line item").max(100),
  })
  .refine((invoice) => invoice.dueDate >= invoice.issueDate, {
    message: "Due date can't be before the issue date",
    path: ["dueDate"],
  });
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const invoiceStatusSchema = z.enum(["draft", "sent", "paid", "void"]);

/** Field-level error messages keyed by dotted path, e.g. "items.0.unitPrice". */
export type FieldErrors = Record<string, string>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}
