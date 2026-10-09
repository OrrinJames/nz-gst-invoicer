"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 aria-[invalid=true]:border-red-500";

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
} & Omit<ComponentProps<"input">, "name">;

export function Field({ label, name, error, hint, className, ...inputProps }: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <label className={`block space-y-1 ${className ?? ""}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {hint && !error ? <span className="block text-xs text-slate-500">{hint}</span> : null}
      {error ? (
        <span id={errorId} className="block text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

type TextAreaProps = {
  label: string;
  name: string;
  error?: string;
} & Omit<ComponentProps<"textarea">, "name">;

export function TextArea({ label, name, error, ...props }: TextAreaProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea name={name} rows={3} className={inputClass} aria-invalid={error ? true : undefined} {...props} />
      {error ? <span className="block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

export function FormMessage({ status, message }: { status: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      role={status === "error" ? "alert" : "status"}
      className={status === "error" ? "text-sm text-red-600" : "text-sm text-teal-700"}
    >
      {message}
    </p>
  );
}

export { inputClass };
