"use client";

import { useActionState } from "react";
import { saveBusinessProfileAction } from "@/app/settings/actions";
import { initialActionState } from "@/lib/action-state";
import type { BusinessProfile } from "@/lib/data";
import { Field, FormMessage, SubmitButton, TextArea } from "./form-controls";

type Key = "business_name" | "gst_number" | "email" | "address" | "bank_account";

export function BusinessProfileForm({ profile }: { profile: BusinessProfile | null }) {
  const [state, formAction] = useActionState(saveBusinessProfileAction, initialActionState);
  const value = (key: Key) => state.values?.[key] ?? profile?.[key] ?? "";
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business or trading name" name="business_name" defaultValue={value("business_name")} error={errors.business_name} />
        <Field
          label="GST number"
          name="gst_number"
          placeholder="123-456-789"
          defaultValue={value("gst_number")}
          error={errors.gst_number}
          hint="Leave blank if you are not GST-registered; invoices will then not be titled “Tax Invoice”."
        />
        <Field label="Email" name="email" type="email" defaultValue={value("email")} error={errors.email} />
        <Field
          label="Bank account for payments"
          name="bank_account"
          placeholder="12-3456-7890123-00"
          defaultValue={value("bank_account")}
          error={errors.bank_account}
        />
      </div>
      <TextArea label="Address" name="address" defaultValue={value("address")} error={errors.address} />
      <div className="flex items-center gap-4">
        <SubmitButton>Save details</SubmitButton>
        <FormMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}
