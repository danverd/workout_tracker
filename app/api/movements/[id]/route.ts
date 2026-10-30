import { getDb } from "@/db/client";
import { deleteMovement, updateMovement } from "@/features/setup/mutations";
import { parseId, parseJson, route } from "@/lib/http";
import { movementInputSchema } from "@/lib/validation/setup";

type Params = { id: string };

export const PUT = route<Params>("mutation", async (request, { id }) =>
  updateMovement(
    await getDb(),
    parseId(id),
    await parseJson(request, movementInputSchema),
  ),
);

export const DELETE = route<Params>("mutation", async (_request, { id }) =>
  deleteMovement(await getDb(), parseId(id)),
);
