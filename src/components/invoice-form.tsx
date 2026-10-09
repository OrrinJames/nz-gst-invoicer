"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { createInvoiceAction } from "@/app/invoices/actions";
import { initialActionState } from "@/lib/action-state";
import type { Client } from "@/lib/data";
import { calculateInvoice, formatNZD, parseDollars, type TaxMode } from "@/lib/gst";
import { Field, FormMessage, SubmitButton, TextArea, inputClass } from "./form-controls";

type DraftLine = { key: string; description: string; quantity: string; unitPrice: string };

type Props = {
  clients: Pick<Client, "id" | "name">[];
  defaultIssueDate: string;
  defaultDueDate: string;
};

/** Best-effort live preview; invalid lines count as zero until corrected. */
function previewTotals(lines: DraftLine[], mode: TaxMode) {
  const parsed = lines.map((line) => {
    try {
      const quantity = Number(line.quantity);
      const unitPriceCents = parseDollars(line.unitPrice);
      return Number.isFinite(quantity) && quantity > 0 ? { quantity, unitPriceCents } : null;
    } catch {
      return null;
    }
  });
  try {
    const totals = calculateInvoice(
      parsed.map((line) => line ?? { quantity: 0, unitPriceCents: 0 }),
      mode,
    );
    return { totals, lineValid: parsed.map((line) => line !== null) };
  } catch {
    return null;
  }
}

export function InvoiceForm({ clients, defaultIssueDate, defaultDueDate }: Props) {
  const [state, formAction] = useActionState(createInvoiceAction, initialActionState);
  const keyPrefix = useId();
  const [nextKey, setNextKey] = useState(1);
  // Every field is controlled: React 19 resets uncontrolled fields after a
  // form action, which would wipe the user's input on a validation error.
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(defaultIssueDate);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [notes, setNotes] = useState("");
  const [taxMode, setTaxMode] = useState<TaxMode>("exclusive");
  const [lines, setLines] = useState<DraftLine[]>([
    { key: `${keyPrefix}-0`, description: "", quantity: "1", unitPrice: "" },
  ]);

  const preview = useMemo(() => previewTotals(lines, taxMode), [lines, taxMode]);
  const errors = state.errors ?? {};

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [
      ...current,
      { key: `${keyPrefix}-${nextKey}`, description: "", quantity: "1", unitPrice: "" },
    ]);
    setNextKey((key) => key + 1);
  }

  function removeLine(index: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  }

  const serializedItems = JSON.stringify(
    lines.map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice })),
  );

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <input type="hidden" name="items" value={serializedItems} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Client</span>
          <select
            name="clientId"
            className={inputClass}
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            aria-invalid={errors.clientId ? true : undefined}>
            <option value="" disabled>
              Choose a client…
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {errors.clientId ? <span className="block text-xs text-red-600">{errors.clientId}</span> : null}
        </label>
        <Field
          label="Issue date"
          name="issueDate"
          type="date"
          value={issueDate}
          onChange={(event) => setIssueDate(event.target.value)}
          error={errors.issueDate}
        />
        <Field
          label="Due date"
          name="dueDate"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          error={errors.dueDate}
        />
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Prices entered</legend>
        <div className="flex gap-6 text-sm">
          {(["exclusive", "inclusive"] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-2">
              <input
                type="radio"
                name="taxMode"
                value={mode}
                checked={taxMode === mode}
                onChange={() => setTaxMode(mode)}
              />
              {mode === "exclusive" ? "Excluding GST (GST added on top)" : "Including GST"}
            </label>
          ))}
        </div>
      </fieldset>

      <section className="space-y-3">
        <div className="hidden grid-cols-[1fr_6rem_8rem_8rem_2.5rem] gap-3 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        {lines.map((line, index) => (
          <div key={line.key} className="grid gap-3 md:grid-cols-[1fr_6rem_8rem_8rem_2.5rem] md:items-start">
            <div>
              <input
                aria-label={`Line ${index + 1} description`}
                className={inputClass}
                value={line.description}
                onChange={(event) => updateLine(index, { description: event.target.value })}
                placeholder="e.g. Development — sprint 3"
              />
              <LineError message={errors[`items.${index}.description`]} />
            </div>
            <div>
              <input
                aria-label={`Line ${index + 1} quantity`}
                className={inputClass}
                inputMode="decimal"
                value={line.quantity}
                onChange={(event) => updateLine(index, { quantity: event.target.value })}
              />
              <LineError message={errors[`items.${index}.quantity`]} />
            </div>
            <div>
              <input
                aria-label={`Line ${index + 1} unit price`}
                className={inputClass}
                inputMode="decimal"
                placeholder="0.00"
                value={line.unitPrice}
                onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
              />
              <LineError message={errors[`items.${index}.unitPrice`]} />
            </div>
            <div className="py-2 text-right text-sm tabular-nums text-slate-700">
              {preview?.lineValid[index] ? formatNZD(preview.totals.lineAmounts[index] ?? 0) : "—"}
            </div>
            <button
              type="button"
              onClick={() => removeLine(index)}
              disabled={lines.length === 1}
              aria-label={`Remove line ${index + 1}`}
              className="h-9 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
            >
              ×
            </button>
          </div>
        ))}
        {errors.items ? <p className="text-xs text-red-600">{errors.items}</p> : null}
        <button type="button" onClick={addLine} className="text-sm font-medium text-teal-700 hover:underline">
          + Add line
        </button>
      </section>

      <section className="ml-auto w-full max-w-xs space-y-1 text-sm tabular-nums">
        <TotalRow label="Subtotal (excl. GST)" cents={preview?.totals.subtotalCents} />
        <TotalRow label="GST 15%" cents={preview?.totals.gstCents} />
        <TotalRow label="Total (incl. GST)" cents={preview?.totals.totalCents} strong />
      </section>

      <TextArea
        label="Notes (optional)"
        name="notes"
        placeholder="Payment terms, bank account, thanks…"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        error={errors.notes}
      />

      <div className="flex items-center gap-4">
        <SubmitButton pendingLabel="Creating…">Create invoice</SubmitButton>
        <FormMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}

function LineError({ message }: { message?: string }) {
  return message ? <span className="mt-1 block text-xs text-red-600">{message}</span> : null;
}

function TotalRow({ label, cents, strong = false }: { label: string; cents?: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-slate-200 pt-2 font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{cents === undefined ? "—" : formatNZD(cents)}</span>
    </div>
  );
}
