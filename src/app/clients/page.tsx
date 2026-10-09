import type { Metadata } from "next";
import Link from "next/link";
import { ClientForm } from "@/components/client-form";
import { requireUser } from "@/lib/auth";
import { listClients } from "@/lib/data";
import { createClientAction } from "./actions";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const { supabase } = await requireUser();
  const clients = await listClients(supabase);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Clients</h1>

      {clients.length === 0 ? (
        <p className="text-sm text-slate-600">No clients yet. Add one below.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {clients.map((client) => (
            <li key={client.id}>
              <Link href={`/clients/${client.id}`} className="flex justify-between gap-4 px-4 py-3 hover:bg-slate-50">
                <span className="font-medium">{client.name}</span>
                <span className="truncate text-sm text-slate-500">{client.email}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Add a client</h2>
        <ClientForm action={createClientAction} submitLabel="Add client" resetOnSuccess />
      </section>
    </div>
  );
}
