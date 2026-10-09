"use client";

import { useActionState } from "react";
import { signInWithMagicLinkAction } from "@/app/login/actions";
import { initialActionState } from "@/lib/action-state";
import { Field, FormMessage, SubmitButton } from "./form-controls";

export function LoginForm() {
  const [state, formAction] = useActionState(signInWithMagicLinkAction, initialActionState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field label="Email" name="email" type="email" autoComplete="email" required error={state.errors?.email} />
      <SubmitButton pendingLabel="Sending…">Email me a sign-in link</SubmitButton>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
