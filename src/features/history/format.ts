import { weekBounds } from "@/lib/dates";
import type { CardioEntryDto, SessionSummaryDto } from "@/types/domain";

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

function parts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return { year, month: MONTHS[month - 1], day, weekday: WEEKDAYS[weekday] };
}

/** "Fri, Oct 30" */
export function formatDay(date: string) {
  const p = parts(date);
  return `${p.weekday}, ${p.month} ${p.day}`;
}

/** "Oct 26 – Nov 1" */
export function formatRange(start: string, end: string) {
  const a = parts(start);
  const b = parts(end);
  return a.month === b.month
    ? `${a.month} ${a.day} – ${b.day}`
    : `${a.month} ${a.day} – ${b.month} ${b.day}`;
}

/** "October 2026" */
export function formatMonth(date: string) {
  const p = parts(date);
  return `${p.month} ${p.year}`;
}

export function formatVolume(volume: number) {
  return `${Math.round(volume).toLocaleString("en-US")} lb`;
}

export function formatNumber(value: number) {
  return String(Math.round(value * 100) / 100);
}

export function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatCardio(cardio: CardioEntryDto) {
  return [
    formatDuration(cardio.durationSec),
    cardio.distance !== null
      ? `${formatNumber(cardio.distance)} ${cardio.distanceUnit ?? ""}`.trim()
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Secondary line of a session row. */
export function sessionDetail(session: SessionSummaryDto, withDate: boolean) {
  const bits: string[] = [];
  if (withDate) bits.push(formatDay(session.date));
  if (session.kind === "cardio") {
    bits.push(session.cardio ? formatCardio(session.cardio) : "Cardio");
  } else {
    bits.push(plural(session.doneSetCount, "set"));
    bits.push(formatVolume(session.totalVolume));
  }
  return bits.filter(Boolean).join(" · ");
}

export function sessionTitle(session: SessionSummaryDto) {
  if (session.kind === "cardio")
    return session.cardio?.activity || session.title || "Cardio";
  return session.title || session.dayName || "Freestyle";
}

export interface WeekGroup {
  start: string;
  end: string;
  sessions: SessionSummaryDto[];
}

/** Groups newest-first sessions into Mon–Sun weeks, newest week first. */
export function groupByWeek(sessions: SessionSummaryDto[]): WeekGroup[] {
  const groups: WeekGroup[] = [];
  for (const session of sessions) {
    const { start, end } = weekBounds(session.date);
    const last = groups[groups.length - 1];
    if (last && last.start === start) last.sessions.push(session);
    else groups.push({ start, end, sessions: [session] });
  }
  return groups;
}
