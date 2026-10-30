import { getDb } from "@/db/client";
import { deleteSet, upsertSet } from "@/db/queries/sessions";
import { HttpError, noContent, parseId, parseJson, route } from "@/lib/http";
import { sessionSetInputSchema } from "@/lib/validation/sessions";

type Params = { id: string; exerciseId: string; setId: string };

export const PUT = route<Params>(
  "mutation",
  async (request, { id, exerciseId, setId }) => {
    const body = await parseJson(request, sessionSetInputSchema);
    if (body.id !== parseId(setId))
      throw new HttpError(400, "Set id does not match the URL.");
    return upsertSet(await getDb(), parseId(id), parseId(exerciseId), body);
  },
);

export const DELETE = route<Params>(
  "mutation",
  async (_request, { id, exerciseId, setId }) => {
    await deleteSet(
      await getDb(),
      parseId(id),
      parseId(exerciseId),
      parseId(setId),
    );
    return noContent();
  },
);
