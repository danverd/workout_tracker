import { getDb } from "@/db/client";
import { listMovements } from "@/db/queries/setup";
import { createMovement } from "@/features/setup/mutations";
import { created, parseJson, route } from "@/lib/http";
import { movementInputSchema } from "@/lib/validation/setup";

export const GET = route("read", async () => listMovements(await getDb()));

export const POST = route("mutation", async (request) =>
  created(
    await createMovement(
      await getDb(),
      await parseJson(request, movementInputSchema),
    ),
  ),
);
