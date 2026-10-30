import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getExerciseHistory } from "@/db/queries/history";
import { formatVolume } from "@/features/history/format";
import { formatDay, formatNumber } from "@/lib/format";
import { idSchema } from "@/lib/validation/setup";
import { AppShell } from "@/ui/AppShell";
import { EmptyState } from "@/ui/EmptyState";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function ExerciseHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const history = await getExerciseHistory(await getDb(), id);
  if (!history) notFound();
  const { bestSet } = history;

  return (
    <AppShell
      header={
        <ScreenHeader
          title={history.name}
          backHref="/history"
          backLabel="History"
        />
      }
    >
      {history.sessions.length === 0 ? (
        <EmptyState message="No sets logged for this exercise yet." />
      ) : (
        <div className="flex flex-col gap-6">
          {bestSet ? (
            <div className="border-plate-yellow border-l-4 pl-3">
              <p className="text-body text-rubber">Best set (highest volume)</p>
              <p className="font-display text-numeral text-steel leading-none font-bold tabular-nums">
                {formatNumber(bestSet.weight)} × {bestSet.reps}
              </p>
              <p className="text-body text-rubber mt-1">
                {formatVolume(bestSet.volume)} ·{" "}
                <Link
                  href={`/history/${bestSet.sessionId}`}
                  className="text-plate-blue"
                >
                  {formatDay(bestSet.date)}
                </Link>
              </p>
            </div>
          ) : null}
          {history.sessions.map((entry) => (
            <section
              key={entry.sessionId}
              className="border-hairline border-t pt-3"
            >
              <Link
                href={`/history/${entry.sessionId}`}
                className="text-lead text-plate-blue font-medium"
              >
                {formatDay(entry.date)}
                {entry.locationName ? ` · ${entry.locationName}` : ""}
              </Link>
              <ul>
                {entry.sets.map((set) => (
                  <li
                    key={set.position}
                    className="flex items-baseline gap-3 py-1.5"
                  >
                    <span className="text-body text-rubber w-5">
                      {set.position + 1}
                    </span>
                    <span className="font-display text-title text-steel flex-1 font-semibold tabular-nums">
                      {formatNumber(set.weight)} × {set.reps ?? 0}
                    </span>
                    <span className="text-body text-rubber tabular-nums">
                      {formatVolume(set.volume)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-meta text-rubber">
                Total {formatVolume(entry.totalVolume)}
              </p>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
