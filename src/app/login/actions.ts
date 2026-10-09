"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { errorState, field, type ActionState } from "@/lib/action-state";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInWithMagicLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = z.email().safeParse(field(formData, "email").trim());
  if (!email.success) {
    return errorState("Enter a valid email address.", { email: "Enter a valid email address." });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${env().NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  if (error) {
    return errorState("We couldn't send a sign-in link right now. Please try again shortly.");
  }

  return { status: "success", message: `Check ${email.data} for your sign-in link.` };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
