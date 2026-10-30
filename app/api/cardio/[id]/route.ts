import { getDb } from "@/db/client";
import { deleteCardio, upsertCardio } from "@/db/queries/cardio";
import { HttpError, parseId, parseJson, route } from "@/lib/http";
import { cardioInputSchema } from "@/lib/validation/sessions";

type Params = { id: string };

export const PUT = route<Params>("mutation", async (request, { id }) => {
  const input = await parseJson(request, cardioInputSchema);
  if (input.id !== parseId(id))
    throw new HttpError(400, "Cardio id does not match the URL.");
  return upsertCardio(await getDb(), input);
});

export const DELETE = route<Params>("mutation", async (_request, { id }) => {
  if (!(await deleteCardio(await getDb(), parseId(id))))
    throw new HttpError(404, "Cardio entry not found.");
  return { ok: true };
});
