import { getDb } from "@/db/client";
import { getExerciseHistory } from "@/db/queries/history";
import { HttpError, parseId, parseQuery, route } from "@/lib/http";
import { exerciseHistoryQuerySchema } from "@/lib/validation/history";

export const GET = route<{ id: string }>("read", async (request, { id }) => {
  const { limit } = parseQuery(request, exerciseHistoryQuerySchema);
  const history = await getExerciseHistory(await getDb(), parseId(id), limit);
  if (!history) throw new HttpError(404, "Exercise not found.");
  return history;
});
