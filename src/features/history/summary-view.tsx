"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import { addDays } from "@/lib/dates";
import {
  formatMonth,
  formatRange,
  formatVolume,
  plural,
} from "@/features/history/format";
import { SessionRow } from "@/features/history/session-row";
import type { SummaryResponseDto } from "@/features/history/types";
import { Chip } from "@/ui/Chip";
import { IconButton } from "@/ui/IconButton";
import { ChevronLeftIcon, ChevronRightIcon } from "@/ui/icons";

type Period = "week" | "month";

export function SummaryView({
  initial,
  today,
}: {
  initial: SummaryResponseDto;
  today: string;
}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(period: Period, anchor: string) {
    setLoading(true);
    setError(null);
    try {
      setData(
        await apiGet<SummaryResponseDto>(
          `/api/summaries?period=${period}&anchor=${anchor}&count=1`,
        ),
      );
    } catch {
      setError("Couldn't load this period. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const { current, period } = data;
  const isCurrent = current.end >= today;
  const label =
    period === "month"
      ? formatMonth(current.start)
      : formatRange(current.start, current.end);

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label="Period" className="flex gap-2">
        <Chip
          selected={period === "week"}
          onClick={() => load("week", isCurrent ? today : current.start)}
        >
          Week
        </Chip>
        <Chip
          selected={period === "month"}
          onClick={() => load("month", isCurrent ? today : current.start)}
        >
          Month
        </Chip>
      </div>

      <div className="flex items-center justify-between">
        <IconButton
          label={`Previous ${period}`}
          icon={<ChevronLeftIcon />}
          onClick={() => load(period, addDays(current.start, -1))}
        />
        <h2 className="font-display text-title text-steel font-semibold">
          {label}
        </h2>
        <IconButton
          label={`Next ${period}`}
          disabled={isCurrent}
          icon={<ChevronRightIcon />}
          onClick={() => load(period, addDays(current.end, 1))}
        />
      </div>

      <div
        aria-busy={loading}
        className={`flex flex-col gap-6 ${loading ? "opacity-60" : ""}`}
      >
        <div>
          <p className="font-display text-numeral text-steel leading-none font-bold tabular-nums">
            {formatVolume(current.totalVolume)}
          </p>
          <p className="text-body text-rubber mt-1">
            {plural(current.strengthCount, "lifting session")}
            {" · "}
            {plural(current.cardioCount, "cardio session")}
          </p>
        </div>

        {data.sessions.length > 0 ? (
          <section aria-label="Sessions in this period">
            {data.sessions.map((session) => (
              <SessionRow key={session.id} session={session} withDate />
            ))}
          </section>
        ) : (
          <p className="text-lead text-rubber">
            No sessions with logged sets in this {period}.
          </p>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-body text-bumper font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
