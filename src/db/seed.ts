import { and, eq } from "drizzle-orm";
import { database } from "./client";
import {
  exercises as exerciseTable,
  templateExercises,
  templateSets,
  workoutTemplates,
} from "./schema";
import { exercises, templates } from "@/lib/templates";

async function seed() {
  const db = database();
  for (const exercise of exercises)
    await db
      .insert(exerciseTable)
      .values({
        slug: exercise.slug,
        name: exercise.name,
        inputMode: exercise.inputMode,
        effectiveWeightRule: exercise.effectiveWeightRule,
      })
      .onConflictDoNothing();
  for (const template of templates) {
    await db
      .insert(workoutTemplates)
      .values({ slug: template.slug, name: template.name, kind: template.kind })
      .onConflictDoNothing();
    const [templateRow] = await db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.slug, template.slug));
    for (const [index, slug] of template.exerciseSlugs.entries()) {
      const [exercise] = await db
        .select()
        .from(exerciseTable)
        .where(eq(exerciseTable.slug, slug));
      await db
        .insert(templateExercises)
        .values({
          templateId: templateRow.id,
          exerciseId: exercise.id,
          position: index + 1,
        })
        .onConflictDoNothing();
      const [membership] = await db
        .select()
        .from(templateExercises)
        .where(
          and(
            eq(templateExercises.templateId, templateRow.id),
            eq(templateExercises.exerciseId, exercise.id),
          ),
        );
      const definition = exercises.find((item) => item.slug === slug)!;
      await db
        .insert(templateSets)
        .values(
          definition.defaultSets.map((set) => ({
            templateExerciseId: membership.id,
            position: set.position,
            targetKind: set.target.kind,
            targetReps: set.target.kind === "reps" ? set.target.reps : null,
            baselineInputWeight: set.baselineInputWeight,
          })),
        )
        .onConflictDoNothing();
    }
  }
}
seed()
  .then(() => console.log("Seeded workout catalog."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
