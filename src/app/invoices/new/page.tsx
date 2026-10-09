import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceForm } from "@/components/invoice-form";
import { requireUser } from "@/lib/auth";
import { listClients } from "@/lib/data";
import { addDays, todayInNZ } from "@/lib/dates";

export const metadata: Metadata = { title: "New invoice" };

const DEFAULT_PAYMENT_TERMS_DAYS = 20;

export default async function NewInvoicePage() {
  const { supabase } = await requireUser();
  const clients = await listClients(supabase);
  const issueDate = todayInNZ();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New invoice</h1>
      {clients.length === 0 ? (
        <p className="text-sm text-slate-600">
          You need a client first.{" "}
          <Link href="/clients" className="font-medium text-teal-700 underline">
            Add a client
          </Link>
          .
        </p>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <InvoiceForm
            clients={clients.map(({ id, name }) => ({ id, name }))}
            defaultIssueDate={issueDate}
            defaultDueDate={addDays(issueDate, DEFAULT_PAYMENT_TERMS_DAYS)}
          />
        </div>
      )}
    </div>
  );
}
