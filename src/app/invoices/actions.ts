"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorState, field, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { calculateInvoice } from "@/lib/gst";
import { canTransition } from "@/lib/invoice-status";
import { invoiceSchema, invoiceStatusSchema, toFieldErrors } from "@/lib/validation";

function parseItems(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function createInvoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = invoiceSchema.safeParse({
    clientId: field(formData, "clientId"),
    taxMode: field(formData, "taxMode"),
    issueDate: field(formData, "issueDate"),
    dueDate: field(formData, "dueDate"),
    notes: field(formData, "notes"),
    items: parseItems(field(formData, "items")),
  });
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }

  const invoice = parsed.data;
  // Totals are always recomputed on the server; the browser preview is never trusted.
  const totals = calculateInvoice(invoice.items, invoice.taxMode);

  const { supabase } = await requireUser();
  const { data: invoiceId, error } = await supabase.rpc("create_invoice", {
    p_client_id: invoice.clientId,
    p_tax_mode: invoice.taxMode,
    p_issue_date: invoice.issueDate,
    p_due_date: invoice.dueDate,
    p_notes: invoice.notes,
    p_subtotal_cents: totals.subtotalCents,
    p_gst_cents: totals.gstCents,
    p_total_cents: totals.totalCents,
    p_items: invoice.items.map((item, index) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      amount_cents: totals.lineAmounts[index],
    })),
  });

  if (error || !invoiceId) {
    return errorState("Could not create the invoice. Please try again.");
  }

  revalidatePath("/invoices");
  revalidatePath("/");
  redirect(`/invoices/${invoiceId}`);
}

const statusChangeSchema = z.object({
  invoiceId: z.uuid(),
  status: invoiceStatusSchema,
});

export async function updateInvoiceStatusAction(formData: FormData): Promise<void> {
  const parsed = statusChangeSchema.safeParse({
    invoiceId: field(formData, "invoiceId"),
    status: field(formData, "status"),
  });
  if (!parsed.success) {
    throw new Error("Invalid status change");
  }
  const { invoiceId, status } = parsed.data;

  const { supabase } = await requireUser();
  const { data: current, error: readError } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (readError || !current) {
    throw new Error("Invoice not found");
  }
  if (!canTransition(current.status, status)) {
    throw new Error(`An invoice can't move from ${current.status} to ${status}`);
  }

  // Guard on the status we read, so a concurrent change can't be overwritten.
  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", invoiceId)
    .eq("status", current.status);
  if (error) {
    throw new Error("Could not update the invoice status");
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function deleteDraftInvoiceAction(formData: FormData): Promise<void> {
  const invoiceId = z.uuid().parse(field(formData, "invoiceId"));
  const { supabase } = await requireUser();

  // RLS only permits deleting drafts; the status filter makes that explicit here too.
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId).eq("status", "draft");
  if (error) {
    throw new Error("Could not delete the invoice");
  }

  revalidatePath("/invoices");
  revalidatePath("/");
  redirect("/invoices");
}
