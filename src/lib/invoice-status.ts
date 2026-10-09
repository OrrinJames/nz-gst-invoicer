import type { InvoiceStatus } from "./database.types";

/**
 * Allowed status transitions. Issued invoices are never deleted or edited;
 * a mistake is corrected by voiding and re-issuing, which keeps the
 * numbering sequence auditable.
 */
const TRANSITIONS: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = {
  draft: ["sent", "void"],
  sent: ["paid", "void"],
  paid: [],
  void: [],
};

export function allowedTransitions(from: InvoiceStatus): readonly InvoiceStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export const STATUS_LABELS: Readonly<Record<InvoiceStatus, string>> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  void: "Void",
};

/** True when a sent invoice is past its due date (dates as YYYY-MM-DD). */
export function isOverdue(status: InvoiceStatus, dueDate: string, today: string): boolean {
  return status === "sent" && dueDate < today;
}
