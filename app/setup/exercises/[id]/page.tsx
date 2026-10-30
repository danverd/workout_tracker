import { notFound } from "next/navigation";
import { connection } from "next/server";

import { getDb } from "@/db/client";
import { getExercise, listEquipment, listMovements } from "@/db/queries/setup";
import { ExerciseForm } from "@/features/setup/ExerciseForm";
import { idSchema } from "@/lib/validation/setup";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const db = await getDb();
  const [exercise, movements, equipment] = await Promise.all([
    getExercise(db, parsed.data),
    listMovements(db),
    listEquipment(db),
  ]);
  if (!exercise) notFound();
  return (
    <AppShell
      header={
        <ScreenHeader
          title={exercise.name}
          backHref="/setup/exercises"
          backLabel="Back to exercises"
        />
      }
    >
      <ExerciseForm
        key={exercise.id}
        movements={movements}
        equipment={equipment}
        exercise={exercise}
      />
    </AppShell>
  );
}
