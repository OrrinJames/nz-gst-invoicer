import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getBusinessProfile, getInvoice } from "@/lib/data";
import { formatDate, todayInNZ } from "@/lib/dates";
import { formatNZD } from "@/lib/gst";
import { STATUS_LABELS, allowedTransitions, isOverdue } from "@/lib/invoice-status";
import { deleteDraftInvoiceAction, updateInvoiceStatusAction } from "../actions";

export const metadata: Metadata = { title: "Invoice" };

const ACTION_LABELS = { sent: "Mark as sent", paid: "Mark as paid", void: "Void", draft: "Back to draft" } as const;

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [invoice, profile] = await Promise.all([getInvoice(supabase, id), getBusinessProfile(supabase)]);
  const { client, items } = invoice;

  // A document is only a *tax* invoice when the supplier is GST-registered.
  const isTaxInvoice = Boolean(profile?.gst_number);
  const priceLabel = invoice.tax_mode === "inclusive" ? "incl. GST" : "excl. GST";

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link href="/invoices" className="mr-auto text-sm text-teal-700 hover:underline">
          ← Invoices
        </Link>
        <StatusBadge status={invoice.status} overdue={isOverdue(invoice.status, invoice.due_date, todayInNZ())} />
        {allowedTransitions(invoice.status).map((next) => (
          <form key={next} action={updateInvoiceStatusAction}>
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <input type="hidden" name="status" value={next} />
            <button
              type="submit"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
              title={`Change status to ${STATUS_LABELS[next]}`}
            >
              {ACTION_LABELS[next]}
            </button>
          </form>
        ))}
        {invoice.status === "draft" ? (
          <form action={deleteDraftInvoiceAction}>
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <button
              type="submit"
              className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Delete draft
            </button>
          </form>
        ) : null}
        <PrintButton />
      </div>

      <article className="print-sheet mx-auto max-w-3xl space-y-8 rounded-lg border border-slate-200 bg-white p-10 shadow-sm">
        <header className="flex flex-wrap justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{isTaxInvoice ? "Tax Invoice" : "Invoice"}</h1>
            <p className="text-slate-600">{invoice.invoice_number}</p>
            {invoice.status === "void" ? <p className="font-semibold text-red-700">VOID</p> : null}
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{profile?.business_name ?? "Your business name"}</p>
            {profile?.gst_number ? <p>GST No. {profile.gst_number}</p> : null}
            {profile?.address ? <p className="whitespace-pre-line text-slate-600">{profile.address}</p> : null}
            {profile?.email ? <p className="text-slate-600">{profile.email}</p> : null}
          </div>
        </header>

        <section className="flex flex-wrap justify-between gap-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Bill to</p>
            <p className="font-semibold">{client?.name}</p>
            {client?.address ? <p className="whitespace-pre-line text-slate-600">{client.address}</p> : null}
            {client?.gst_number ? <p className="text-slate-600">GST No. {client.gst_number}</p> : null}
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-right">
            <dt className="text-slate-500">Issue date</dt>
            <dd>{formatDate(invoice.issue_date)}</dd>
            <dt className="text-slate-500">Due date</dt>
            <dd>{formatDate(invoice.due_date)}</dd>
          </dl>
        </section>

        <table className="w-full text-sm">
          <thead className="border-b-2 border-slate-900 text-left">
            <tr>
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit price ({priceLabel})</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-2 pr-4">{item.description}</td>
                <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2 text-right tabular-nums">{formatNZD(item.unit_price_cents)}</td>
                <td className="py-2 text-right tabular-nums">{formatNZD(item.amount_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto w-full max-w-xs space-y-1 text-sm tabular-nums">
          <div className="flex justify-between">
            <dt>Subtotal (excl. GST)</dt>
            <dd>{formatNZD(invoice.subtotal_cents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>GST 15%</dt>
            <dd>{formatNZD(invoice.gst_cents)}</dd>
          </div>
          <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-base font-bold">
            <dt>Total (incl. GST)</dt>
            <dd>{formatNZD(invoice.total_cents)}</dd>
          </div>
        </dl>

        {invoice.notes || profile?.bank_account ? (
          <footer className="space-y-2 border-t border-slate-200 pt-6 text-sm text-slate-600">
            {profile?.bank_account ? (
              <p>
                Please pay to <span className="font-medium text-slate-900">{profile.bank_account}</span>, quoting{" "}
                {invoice.invoice_number}.
              </p>
            ) : null}
            {invoice.notes ? <p className="whitespace-pre-line">{invoice.notes}</p> : null}
          </footer>
        ) : null}
      </article>
    </div>
  );
}
