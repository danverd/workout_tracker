import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getSessionDetail } from "@/db/queries/history";
import { DeleteCardioButton } from "@/features/history/delete-cardio-button";
import {
  formatCardio,
  formatDay,
  formatNumber,
  formatVolume,
  plural,
} from "@/features/history/format";
import { idSchema } from "@/lib/validation/setup";
import { buttonClass } from "@/ui/button-styles";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function HistorySessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const detail = await getSessionDetail(await getDb(), id);
  if (!detail) notFound();
  const { session, locationName, doneSetCount, totalVolume } = detail;
  const isCardio = session.kind === "cardio";

  const exercises = session.exercises
    .map((exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((set) => set.done),
    }))
    .filter((exercise) => exercise.sets.length > 0);

  return (
    <AppShell
      header={
        <ScreenHeader
          title={
            isCardio
              ? (session.cardio?.activity ?? "Cardio")
              : session.title || "Workout"
          }
          backHref="/history"
          backLabel="History"
          action={
            isCardio ? null : (
              <Link
                href={`/session/${session.id}`}
                className={`${buttonClass("quiet")} !min-h-11`}
              >
                Edit
              </Link>
            )
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-body text-rubber">
          {[formatDay(session.date), locationName].filter(Boolean).join(" · ")}
        </p>

        {isCardio && session.cardio ? (
          <div className="flex flex-col gap-4">
            <p className="font-display text-numeral text-steel leading-none font-bold tabular-nums">
              {formatCardio(session.cardio) || "No details"}
            </p>
            {session.notes ? (
              <p className="text-lead text-steel">{session.notes}</p>
            ) : null}
            <DeleteCardioButton id={session.id} />
          </div>
        ) : (
          <>
            <div>
              <p className="font-display text-numeral text-steel leading-none font-bold tabular-nums">
                {formatVolume(totalVolume)}
              </p>
              <p className="text-body text-rubber mt-1">
                {plural(doneSetCount, "set")} done
                {session.finishedAt ? "" : " · not finished"}
              </p>
            </div>
            {exercises.length > 0 ? (
              exercises.map((exercise) => (
                <section
                  key={exercise.id}
                  className="border-hairline border-t pt-3"
                >
                  <h2 className="font-display text-title text-steel font-semibold">
                    {exercise.exerciseId ? (
                      <Link
                        href={`/history/exercise/${exercise.exerciseId}`}
                        className="text-plate-blue"
                      >
                        {exercise.name}
                      </Link>
                    ) : (
                      exercise.name
                    )}
                  </h2>
                  <ul>
                    {exercise.sets.map((set, index) => (
                      <li
                        key={set.id}
                        className="flex items-baseline gap-3 py-1.5"
                      >
                        <span className="text-body text-rubber w-5">
                          {index + 1}
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
                </section>
              ))
            ) : (
              <p className="text-lead text-rubber">No sets were marked done.</p>
            )}
            {session.notes ? (
              <p className="text-body text-steel">{session.notes}</p>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
