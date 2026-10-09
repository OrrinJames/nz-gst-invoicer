"use client";

import { useActionState } from "react";
import { deleteClientAction } from "@/app/clients/actions";
import { initialActionState } from "@/lib/action-state";
import { FormMessage } from "./form-controls";

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const [state, formAction, pending] = useActionState(
    () => deleteClientAction(clientId),
    initialActionState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Delete this client? This can't be undone.")) {
          event.preventDefault();
        }
      }}
      className="flex items-center gap-4"
    >
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete client"}
      </button>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
