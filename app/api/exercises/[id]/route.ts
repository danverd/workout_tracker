import { getDb } from "@/db/client";
import {
  deleteExercise,
  setExerciseArchived,
  updateExercise,
} from "@/db/mutations/setup";
import { parseId, parseJson, route } from "@/lib/http";
import {
  archiveInputSchema,
  exerciseInputSchema,
} from "@/lib/validation/setup";

type Params = { id: string };

export const PUT = route<Params>("mutation", async (request, { id }) =>
  updateExercise(
    await getDb(),
    parseId(id),
    await parseJson(request, exerciseInputSchema),
  ),
);

export const PATCH = route<Params>("mutation", async (request, { id }) => {
  const { archived } = await parseJson(request, archiveInputSchema);
  return setExerciseArchived(await getDb(), parseId(id), archived);
});

export const DELETE = route<Params>("mutation", async (_request, { id }) =>
  deleteExercise(await getDb(), parseId(id)),
);
