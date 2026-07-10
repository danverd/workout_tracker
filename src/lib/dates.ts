const timeZone = "America/New_York";

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function todayInNewYork(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00Z`);
}
function format(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function addDays(value: string, days: number) {
  const date = dateAtNoon(value);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}
export function weekBounds(anchor: string) {
  const date = dateAtNoon(anchor);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  const start = addDays(anchor, offset);
  return { start, end: addDays(start, 6) };
}
export function monthBounds(anchor: string) {
  const date = dateAtNoon(anchor);
  const start = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const endDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  );
  return { start, end: format(endDate) };
}
