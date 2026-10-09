import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getBusinessProfile, listInvoices } from "@/lib/data";
import { formatDate, todayInNZ } from "@/lib/dates";
import { formatNZD } from "@/lib/gst";
import { isOverdue } from "@/lib/invoice-status";

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const [invoices, profile] = await Promise.all([listInvoices(supabase), getBusinessProfile(supabase)]);
  const today = todayInNZ();

  const outstanding = invoices.filter((invoice) => invoice.status === "sent");
  const overdue = outstanding.filter((invoice) => isOverdue(invoice.status, invoice.due_date, today));
  const sum = (rows: typeof invoices) => rows.reduce((total, row) => total + row.total_cents, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link
          href="/invoices/new"
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          New invoice
        </Link>
      </div>

      {!profile ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Add your <Link href="/settings" className="font-medium underline">business details</Link> so your
          name and GST number appear on your tax invoices.
        </p>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label="Outstanding" value={formatNZD(sum(outstanding))} detail={`${outstanding.length} sent`} />
        <Stat label="Overdue" value={formatNZD(sum(overdue))} detail={`${overdue.length} past due`} />
        <Stat
          label="Drafts"
          value={String(invoices.filter((invoice) => invoice.status === "draft").length)}
          detail="not yet sent"
        />
      </dl>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent invoices</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-600">No invoices yet. Create your first one to get started.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {invoices.slice(0, 5).map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
                >
                  <span className="font-medium">{invoice.invoice_number}</span>
                  <span className="flex-1 truncate text-sm text-slate-600">{invoice.client?.name}</span>
                  <span className="hidden text-sm text-slate-500 sm:inline">{formatDate(invoice.issue_date)}</span>
                  <StatusBadge
                    status={invoice.status}
                    overdue={isOverdue(invoice.status, invoice.due_date, today)}
                  />
                  <span className="w-28 text-right tabular-nums">{formatNZD(invoice.total_cents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-slate-500">{detail}</dd>
    </div>
  );
}
