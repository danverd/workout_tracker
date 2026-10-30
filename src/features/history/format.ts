import { weekBounds } from "@/lib/dates";
import {
  dateParts,
  formatDay,
  formatDuration,
  formatNumber,
  plural,
} from "@/lib/format";
import type { CardioEntryDto, SessionSummaryDto } from "@/types/domain";

/** "Oct 26 – Nov 1" */
export function formatRange(start: string, end: string) {
  const a = dateParts(start);
  const b = dateParts(end);
  return a.month === b.month
    ? `${a.month} ${a.day} – ${b.day}`
    : `${a.month} ${a.day} – ${b.month} ${b.day}`;
}

/** "October 2026" */
export function formatMonth(date: string) {
  const p = dateParts(date);
  return `${p.month} ${p.year}`;
}

export function formatVolume(volume: number) {
  return `${Math.round(volume).toLocaleString("en-US")} lb`;
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
