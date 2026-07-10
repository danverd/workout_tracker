"use client";
/* eslint-disable react-hooks/set-state-in-effect -- effect fetches the selected server summary. */
import { useCallback, useEffect, useState } from "react";
import AppNav from "@/components/ui/AppNav";
import { addDays, monthBounds, todayInNewYork, weekBounds } from "@/lib/dates";
import { workoutApi, type WorkoutSummary } from "@/lib/workout-api";
export default function SummaryClient({
  period,
}: {
  period: "week" | "month";
}) {
  const [anchor, setAnchor] = useState(todayInNewYork());
  const [result, setResult] = useState<WorkoutSummary | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setResult(await workoutApi.getSummary(period, anchor));
    } catch {
      setError("Unable to load summary.");
    }
  }, [anchor, period]);
  useEffect(() => {
    void load();
  }, [load]);
  const bounds = period === "week" ? weekBounds(anchor) : monthBounds(anchor);
  return (
    <main className="mx-auto min-h-screen max-w-4xl p-5">
      <AppNav active={period === "week" ? "weekly" : "monthly"} />
      <h1 className="text-3xl font-bold">
        {period === "week" ? "Weekly" : "Monthly"} summary
      </h1>
      <div className="mt-4 flex items-center gap-3">
        <button
          className="rounded-lg border border-slate-600 px-3 py-2"
          onClick={() =>
            setAnchor(addDays(anchor, period === "week" ? -7 : -31))
          }
        >
          Previous
        </button>
        <span className="text-sm text-slate-300">
          {bounds.start} – {bounds.end}
        </span>
        <button
          className="rounded-lg border border-slate-600 px-3 py-2"
          onClick={() => setAnchor(addDays(anchor, period === "week" ? 7 : 31))}
        >
          Next
        </button>
      </div>
      {error ? (
        <p className="mt-5 text-red-300">{error}</p>
      ) : (
        <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Finished lifting volume</p>
          <p className="text-3xl font-bold">
            {Math.round(result?.totalVolume ?? 0).toLocaleString()} lb
          </p>
          {result?.workouts.length ? (
            <ul className="mt-5 space-y-2">
              {result.workouts.map((item) => (
                <li className="flex justify-between" key={item.date}>
                  <span>
                    {item.date} · {item.templateName}
                  </span>
                  <span>{Math.round(item.volume).toLocaleString()} lb</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-slate-400">
              No finished workouts in this period.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
