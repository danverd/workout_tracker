import { NextResponse } from "next/server";
import { getWorkout, saveWorkout, WorkoutNotFoundError } from "@/db/queries";
import { requireMutationSession, requireSession } from "@/lib/server";
import { workoutSchema } from "@/lib/validation";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;
  const workout = await getWorkout((await params).date);
  return NextResponse.json({ workout });
}
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const denied = await requireMutationSession();
  if (denied) return denied;
  const date = (await params).date;
  const parsed = workoutSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || parsed.data.date !== date)
    return NextResponse.json({ error: "Invalid workout." }, { status: 400 });
  try {
    return NextResponse.json(await saveWorkout(parsed.data));
  } catch (error) {
    if (!(error instanceof WorkoutNotFoundError)) throw error;
    return NextResponse.json({ error: "Workout not found." }, { status: 404 });
  }
}
