import { getDb } from "@/db/client";
import {
  deleteSessionExercise,
  upsertSessionExercise,
} from "@/db/queries/sessions";
import { HttpError, noContent, parseId, parseJson, route } from "@/lib/http";
import { sessionExerciseInputSchema } from "@/lib/validation/sessions";

type Params = { id: string; exerciseId: string };

export const PUT = route<Params>(
  "mutation",
  async (request, { id, exerciseId }) => {
    const sessionId = parseId(id);
    const body = await parseJson(request, sessionExerciseInputSchema);
    if (body.id !== parseId(exerciseId))
      throw new HttpError(400, "Exercise id does not match the URL.");
    return upsertSessionExercise(await getDb(), sessionId, body);
  },
);

export const DELETE = route<Params>(
  "mutation",
  async (_request, { id, exerciseId }) => {
    await deleteSessionExercise(
      await getDb(),
      parseId(id),
      parseId(exerciseId),
    );
    return noContent();
  },
);
