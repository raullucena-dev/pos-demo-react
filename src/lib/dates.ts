export const TIME_ZONE = "America/Asuncion";

const dateTime = new Intl.DateTimeFormat("es-PY", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** `"2026-10-05"` → `"05/10"` (day/month, as read in Paraguay). */
export function formatShortDay(isoDate: string): string {
  const [, month = "", day = ""] = isoDate.split("-");
  return `${day}/${month}`;
}

/** Today's calendar date in Paraguay, as `YYYY-MM-DD`. */
export function todayInParaguay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Inclusive number of days between two `YYYY-MM-DD` dates. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Every date from `from` to `to`, inclusive. */
export function dateRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}
