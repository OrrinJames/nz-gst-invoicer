"use server";

import { revalidatePath } from "next/cache";
import { errorState, fields, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { businessProfileSchema, toFieldErrors } from "@/lib/validation";

export async function saveBusinessProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = fields(formData, ["business_name", "gst_number", "email", "address", "bank_account"]);
  const parsed = businessProfileSchema.safeParse(values);
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", toFieldErrors(parsed.error), values);
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("business_profiles")
    .upsert({ owner_id: user.id, ...parsed.data }, { onConflict: "owner_id" });
  if (error) {
    return errorState("Could not save your details. Please try again.", undefined, values);
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Business details saved." };
}
