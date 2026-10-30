import { getDb } from "@/db/client";
import { deleteEquipment, updateEquipment } from "@/db/mutations/setup";
import { parseId, parseJson, route } from "@/lib/http";
import { equipmentInputSchema } from "@/lib/validation/setup";

type Params = { id: string };

export const PUT = route<Params>("mutation", async (request, { id }) =>
  updateEquipment(
    await getDb(),
    parseId(id),
    await parseJson(request, equipmentInputSchema),
  ),
);

export const DELETE = route<Params>("mutation", async (_request, { id }) =>
  deleteEquipment(await getDb(), parseId(id)),
);
