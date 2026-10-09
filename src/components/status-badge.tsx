import type { InvoiceStatus } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/invoice-status";

const STYLES: Record<InvoiceStatus | "overdue", string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-800",
  void: "bg-zinc-200 text-zinc-600 line-through",
  overdue: "bg-amber-100 text-amber-800",
};

export function StatusBadge({ status, overdue = false }: { status: InvoiceStatus; overdue?: boolean }) {
  const key = overdue ? "overdue" : status;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[key]}`}>
      {overdue ? "Overdue" : STATUS_LABELS[status]}
    </span>
  );
}
