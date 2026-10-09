import type { FieldErrors } from "@/lib/validation";

/** Shape returned by every form Server Action and consumed by useActionState. */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: FieldErrors;
  /**
   * The submitted values, echoed back on error. React 19 resets uncontrolled
   * form fields after an action, so forms use these as defaultValues to keep
   * what the user typed.
   */
  values?: Record<string, string>;
};

export const initialActionState: ActionState = { status: "idle" };

export function errorState(
  message: string,
  errors?: FieldErrors,
  values?: Record<string, string>,
): ActionState {
  return { status: "error", message, errors, values };
}

/** Collect the named string fields from FormData. */
export function fields<const K extends string>(formData: FormData, names: readonly K[]): Record<K, string> {
  return Object.fromEntries(names.map((name) => [name, field(formData, name)])) as Record<K, string>;
}

/** Read a string field from FormData; missing or file values become "". */
export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
