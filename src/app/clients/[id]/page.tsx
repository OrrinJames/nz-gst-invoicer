import type { Metadata } from "next";
import Link from "next/link";
import { ClientForm } from "@/components/client-form";
import { DeleteClientButton } from "@/components/delete-client-button";
import { requireUser } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { updateClientAction } from "../actions";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const client = await getClient(supabase, id);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href="/clients" className="text-sm text-teal-700 hover:underline">
          ← Clients
        </Link>
        <h1 className="text-2xl font-semibold">{client.name}</h1>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <ClientForm action={updateClientAction.bind(null, client.id)} client={client} submitLabel="Save changes" />
      </section>

      <DeleteClientButton clientId={client.id} />
    </div>
  );
}
