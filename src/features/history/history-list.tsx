"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import { formatRange, groupByWeek } from "@/features/history/format";
import { SessionRow } from "@/features/history/session-row";
import type { HistoryPageDto } from "@/features/history/types";
import type { SessionSummaryDto } from "@/types/domain";
import { Button } from "@/ui/Button";

export function HistoryList({ initial }: { initial: HistoryPageDto }) {
  const [sessions, setSessions] = useState<SessionSummaryDto[]>(
    initial.sessions,
  );
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await apiGet<HistoryPageDto>(
        `/api/history?before=${cursor}`,
      );
      setSessions((current) => [...current, ...page.sessions]);
      setCursor(page.nextCursor);
    } catch {
      setError("Couldn't load more. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {groupByWeek(sessions).map((week) => (
        <section key={week.start} aria-label={`Week of ${week.start}`}>
          <h2 className="font-display text-title text-steel mb-1 font-semibold">
            {formatRange(week.start, week.end)}
          </h2>
          {week.sessions.map((session) => (
            <SessionRow key={session.id} session={session} withDate />
          ))}
        </section>
      ))}
      {error ? (
        <p role="alert" className="text-body text-bumper font-medium">
          {error}
        </p>
      ) : null}
      {cursor ? (
        <Button variant="secondary" block onClick={loadMore} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
