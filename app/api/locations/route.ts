import { getDb } from "@/db/client";
import { listLocations } from "@/db/queries/setup";
import { createLocation } from "@/db/mutations/setup";
import { created, parseJson, route } from "@/lib/http";
import { locationInputSchema } from "@/lib/validation/setup";

export const GET = route("read", async () => listLocations(await getDb()));

export const POST = route("mutation", async (request) =>
  created(
    await createLocation(
      await getDb(),
      await parseJson(request, locationInputSchema),
    ),
  ),
);
