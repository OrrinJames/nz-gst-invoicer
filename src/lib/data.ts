/**
 * Read queries used by Server Components. All run as the signed-in user,
 * so row-level security scopes every result to that user's own data.
 */
import { notFound } from "next/navigation";
import type { Tables } from "@/lib/database.types";
import type { SupabaseServerClient } from "@/lib/supabase/server";

export type Client = Tables<"clients">;
export type Invoice = Tables<"invoices">;
export type InvoiceItem = Tables<"invoice_items">;
export type BusinessProfile = Tables<"business_profiles">;

export type InvoiceListRow = Invoice & { client: Pick<Client, "id" | "name"> | null };
export type InvoiceDetail = Invoice & { client: Client | null; items: InvoiceItem[] };

function fail(context: string, error: { message: string }): never {
  throw new Error(`${context}: ${error.message}`);
}

export async function listClients(supabase: SupabaseServerClient): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*").order("name");
  if (error) fail("Failed to load clients", error);
  return data;
}

export async function getClient(supabase: SupabaseServerClient, id: string): Promise<Client> {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) fail("Failed to load client", error);
  if (!data) notFound();
  return data;
}

export async function listInvoices(supabase: SupabaseServerClient): Promise<InvoiceListRow[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, client:clients(id, name)")
    .order("issue_date", { ascending: false })
    .order("invoice_number", { ascending: false });
  if (error) fail("Failed to load invoices", error);
  return data;
}

export async function getInvoice(supabase: SupabaseServerClient, id: string): Promise<InvoiceDetail> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, client:clients(*), items:invoice_items(*)")
    .eq("id", id)
    .order("position", { referencedTable: "invoice_items" })
    .maybeSingle();
  if (error) fail("Failed to load invoice", error);
  if (!data) notFound();
  return data;
}

export async function getBusinessProfile(
  supabase: SupabaseServerClient,
): Promise<BusinessProfile | null> {
  const { data, error } = await supabase.from("business_profiles").select("*").maybeSingle();
  if (error) fail("Failed to load business profile", error);
  return data;
}
