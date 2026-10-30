import Link from "next/link";
import { connection } from "next/server";

import { getDb } from "@/db/client";
import { listExercises, listMovements } from "@/db/queries/setup";
import { groupByMovement } from "@/features/setup/group-exercises";
import { LOAD_TYPE_OPTIONS } from "@/features/setup/load-types";
import { AppShell } from "@/ui/AppShell";
import { buttonClass } from "@/ui/button-styles";
import { EmptyState } from "@/ui/EmptyState";
import { ListRow } from "@/ui/ListRow";
import { ScreenHeader } from "@/ui/ScreenHeader";

const loadTitle = Object.fromEntries(
  LOAD_TYPE_OPTIONS.map((option) => [option.value, option.title]),
);

export default async function ExercisesPage() {
  await connection();
  const db = await getDb();
  const [exercises, movements] = await Promise.all([
    listExercises(db),
    listMovements(db),
  ]);
  const groups = groupByMovement(
    exercises.filter((e) => !e.archived),
    movements,
  );
  const archived = exercises.filter((e) => e.archived);

  return (
    <AppShell
      header={
        <ScreenHeader
          title="Exercises"
          backHref="/setup"
          backLabel="Back to setup"
          action={
            <Link href="/setup/exercises/new" className={buttonClass("quiet")}>
              Add exercise
            </Link>
          }
        />
      }
    >
      {groups.length === 0 ? (
        <EmptyState
          message="Add your first exercise. You can add several in a row."
          action={
            <Link
              href="/setup/exercises/new"
              className={buttonClass("primary")}
            >
              Add exercise
            </Link>
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.movementId ?? "none"} className="pb-4">
            <h2 className="font-display text-title text-steel pt-2 pb-1 font-semibold">
              {group.title}
            </h2>
            {group.exercises.map((exercise) => (
              <ListRow
                key={exercise.id}
                href={`/setup/exercises/${exercise.id}`}
                title={exercise.name}
                detail={loadTitle[exercise.loadType]}
              />
            ))}
          </section>
        ))
      )}
      {archived.length > 0 ? (
        <section className="pt-2" aria-label="Archived exercises">
          <h2 className="font-display text-title text-rubber pb-1 font-semibold">
            Archived
          </h2>
          {archived.map((exercise) => (
            <ListRow
              key={exercise.id}
              href={`/setup/exercises/${exercise.id}`}
              title={exercise.name}
              detail={loadTitle[exercise.loadType]}
            />
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
