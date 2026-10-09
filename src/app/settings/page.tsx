import type { Metadata } from "next";
import { BusinessProfileForm } from "@/components/business-profile-form";
import { requireUser } from "@/lib/auth";
import { getBusinessProfile } from "@/lib/data";

export const metadata: Metadata = { title: "Business details" };

export default async function SettingsPage() {
  const { supabase } = await requireUser();
  const profile = await getBusinessProfile(supabase);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Business details</h1>
        <p className="text-sm text-slate-600">Printed as the supplier on every invoice.</p>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <BusinessProfileForm profile={profile} />
      </section>
    </div>
  );
}
