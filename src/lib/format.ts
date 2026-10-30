import type { SessionSummaryDto } from "@/types/domain";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "1 set", "3 sets"; pass `many` for irregular plurals. */
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Rounds to two decimals. */
export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatNumber(value: number) {
  return String(round2(value));
}

export function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return { year, month: MONTHS[month - 1], day, weekday: WEEKDAYS[weekday] };
}

/** "Fri, Oct 30" */
export function formatDay(date: string) {
  const p = dateParts(date);
  return `${p.weekday}, ${p.month} ${p.day}`;
}

export function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function sessionTitle(session: SessionSummaryDto) {
  if (session.kind === "cardio")
    return session.cardio?.activity || session.title || "Cardio";
  return session.title || session.dayName || "Freestyle";
}
