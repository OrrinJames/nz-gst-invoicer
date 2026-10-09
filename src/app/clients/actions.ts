"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorState, fields, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { clientSchema, toFieldErrors } from "@/lib/validation";

const CLIENT_FIELDS = ["name", "email", "address", "gst_number"] as const;

function parseClientForm(formData: FormData) {
  const values = fields(formData, CLIENT_FIELDS);
  return { values, parsed: clientSchema.safeParse(values) };
}

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { values, parsed } = parseClientForm(formData);
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", toFieldErrors(parsed.error), values);
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.from("clients").insert(parsed.data);
  if (error) {
    return errorState("Could not save the client. Please try again.", undefined, values);
  }

  revalidatePath("/clients");
  return { status: "success", message: `Added ${parsed.data.name}.` };
}

export async function updateClientAction(
  clientId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!z.uuid().safeParse(clientId).success) {
    return errorState("Unknown client.");
  }
  const { values, parsed } = parseClientForm(formData);
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", toFieldErrors(parsed.error), values);
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.from("clients").update(parsed.data).eq("id", clientId);
  if (error) {
    return errorState("Could not update the client. Please try again.", undefined, values);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return { status: "success", message: "Client updated." };
}

export async function deleteClientAction(clientId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(clientId).success) {
    return errorState("Unknown client.");
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) {
    // 23001 restrict_violation / 23503 foreign_key_violation: invoices reference this client.
    return errorState(
      error.code === "23001" || error.code === "23503"
        ? "This client has invoices, so it can't be deleted."
        : "Could not delete the client. Please try again.",
    );
  }

  revalidatePath("/clients");
  redirect("/clients");
}
