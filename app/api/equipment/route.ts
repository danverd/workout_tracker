import { getDb } from "@/db/client";
import { listEquipment } from "@/db/queries/setup";
import { createEquipment } from "@/db/mutations/setup";
import { created, parseJson, route } from "@/lib/http";
import { equipmentInputSchema } from "@/lib/validation/setup";

export const GET = route("read", async () => listEquipment(await getDb()));

export const POST = route("mutation", async (request) =>
  created(
    await createEquipment(
      await getDb(),
      await parseJson(request, equipmentInputSchema),
    ),
  ),
);
