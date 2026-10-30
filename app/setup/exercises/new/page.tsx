import { connection } from "next/server";

import { getDb } from "@/db/client";
import { listEquipment, listMovements } from "@/db/queries/setup";
import { ExerciseForm } from "@/features/setup/ExerciseForm";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function NewExercisePage() {
  await connection();
  const db = await getDb();
  const [movements, equipment] = await Promise.all([
    listMovements(db),
    listEquipment(db),
  ]);
  return (
    <AppShell
      header={
        <ScreenHeader
          title="New exercise"
          backHref="/setup/exercises"
          backLabel="Back to exercises"
        />
      }
    >
      <ExerciseForm movements={movements} equipment={equipment} />
    </AppShell>
  );
}
