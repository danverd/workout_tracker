export interface RotationDay {
  id: string;
}

/** A past session of the program being rotated (freestyle/cardio excluded). */
export interface RotationSession {
  /** Null for freestyle sessions, which never affect rotation. */
  programId: string | null;
  /** Null when the day was since deleted. */
  programDayId: string | null;
  date: string;
  startedAt: string;
  doneSetCount: number;
}

/**
 * Next program day: the day after the most recent session with at least one
 * done set, wrapping around. Falls back to the first day when there is no
 * qualifying session or its day no longer exists. `days` must be in order.
 */
export function nextProgramDay(
  days: readonly RotationDay[],
  sessions: readonly RotationSession[],
): string | null {
  if (days.length === 0) return null;
  const latest = sessions
    .filter((session) => session.programId !== null && session.doneSetCount > 0)
    .reduce<RotationSession | null>(
      (best, session) =>
        !best ||
        session.date > best.date ||
        (session.date === best.date && session.startedAt > best.startedAt)
          ? session
          : best,
      null,
    );
  const index = days.findIndex((day) => day.id === latest?.programDayId);
  if (index === -1) return days[0].id;
  return days[(index + 1) % days.length].id;
}
