export const NZ_TIME_ZONE = "Pacific/Auckland";

/** Today's date in New Zealand as YYYY-MM-DD, regardless of server time zone. */
export function todayInNZ(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NZ_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Add whole days to a YYYY-MM-DD date string. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${isoDate}`);
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Format YYYY-MM-DD for display, e.g. "1 Mar 2026". */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
