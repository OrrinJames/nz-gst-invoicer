import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">NZ GST Invoicer</h1>
        <p className="text-sm text-slate-600">Sign in with a one-time link sent to your email.</p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          That sign-in link was invalid or has expired. Please request a new one.
        </p>
      ) : null}
      <LoginForm />
    </div>
  );
}
