"use client";

import { useActionState, useEffect, useRef } from "react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import type { Client } from "@/lib/data";
import { Field, FormMessage, SubmitButton, TextArea } from "./form-controls";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  client?: Client;
  submitLabel: string;
  resetOnSuccess?: boolean;
};

export function ClientForm({ action, client, submitLabel, resetOnSuccess = false }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") {
      formRef.current?.reset();
    }
  }, [state, resetOnSuccess]);

  // Prefer what the user just submitted (on error) over the saved record.
  const value = (name: "name" | "email" | "address" | "gst_number") =>
    state.values?.[name] ?? client?.[name] ?? "";

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" required defaultValue={value("name")} error={state.errors?.name} />
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={value("email")}
          error={state.errors?.email}
        />
        <Field
          label="GST number"
          name="gst_number"
          placeholder="123-456-789"
          defaultValue={value("gst_number")}
          error={state.errors?.gst_number}
          hint="Optional. Shown on the invoice for GST-registered clients."
        />
      </div>
      <TextArea label="Address" name="address" defaultValue={value("address")} error={state.errors?.address} />
      <div className="flex items-center gap-4">
        <SubmitButton>{submitLabel}</SubmitButton>
        <FormMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}
