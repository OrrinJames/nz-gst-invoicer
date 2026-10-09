import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { listInvoices } from "@/lib/data";
import { formatDate, todayInNZ } from "@/lib/dates";
import { formatNZD } from "@/lib/gst";
import { isOverdue } from "@/lib/invoice-status";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const { supabase } = await requireUser();
  const invoices = await listInvoices(supabase);
  const today = todayInNZ();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Link
          href="/invoices/new"
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          New invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-slate-600">No invoices yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Number</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Issued</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/invoices/${invoice.id}`} className="text-teal-800 hover:underline">
                      {invoice.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{invoice.client?.name}</td>
                  <td className="px-4 py-2">{formatDate(invoice.issue_date)}</td>
                  <td className="px-4 py-2">{formatDate(invoice.due_date)}</td>
                  <td className="px-4 py-2">
                    <StatusBadge
                      status={invoice.status}
                      overdue={isOverdue(invoice.status, invoice.due_date, today)}
                    />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNZD(invoice.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
