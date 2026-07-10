import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { database } from "@/db/client";
import { workoutTemplates } from "@/db/schema";
import { historyForExerciseSlugs, saveWorkout } from "@/db/queries";
import { templateBySlug } from "@/lib/templates";
import { makeWorkoutFromTemplate } from "@/lib/workout-defaults";
import { createWorkoutSchema } from "@/lib/validation";
import { requireMutationSession } from "@/lib/server";

export async function POST(request: Request) {
  const denied = await requireMutationSession();
  if (denied) return denied;
  const parsed = createWorkoutSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid workout." }, { status: 400 });
  const template = templateBySlug.get(parsed.data.templateSlug);
  if (!template)
    return NextResponse.json({ error: "Invalid template." }, { status: 400 });
  const history = await historyForExerciseSlugs(
    parsed.data.date,
    template.exerciseSlugs,
  );
  const payload = makeWorkoutFromTemplate(
    parsed.data.date,
    template.slug,
    history,
  );
  try {
    const db = database();
    const [templateRow] = await db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.slug, template.slug));
    return NextResponse.json(
      await saveWorkout(payload, { templateId: templateRow?.id ?? null }),
      { status: 201 },
    );
  } catch (error) {
    if (String(error).includes("workout_date_unique"))
      return NextResponse.json(
        { error: "A workout already exists for this date." },
        { status: 409 },
      );
    throw error;
  }
}
