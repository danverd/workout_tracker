import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import {
  deleteSessionExercise,
  SessionQueryError,
  upsertSessionExercise,
} from "@/db/queries/sessions";
import {
  guarded,
  parseId,
  readJson,
  type ExerciseParams,
} from "@/features/session/route";
import { sessionExerciseInputSchema } from "@/lib/validation/sessions";

export function PUT(request: Request, { params }: ExerciseParams) {
  return guarded("mutation", async () => {
    const { id, exerciseId } = await params;
    const sessionId = parseId(id);
    const body = sessionExerciseInputSchema.parse(await readJson(request));
    if (body.id !== parseId(exerciseId))
      throw new SessionQueryError(400, "Exercise id does not match the URL.");
    return NextResponse.json(
      await upsertSessionExercise(await getDb(), sessionId, body),
    );
  });
}

export function DELETE(_request: Request, { params }: ExerciseParams) {
  return guarded("mutation", async () => {
    const { id, exerciseId } = await params;
    await deleteSessionExercise(
      await getDb(),
      parseId(id),
      parseId(exerciseId),
    );
    return new NextResponse(null, { status: 204 });
  });
}
