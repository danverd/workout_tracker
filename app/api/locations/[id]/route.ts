import { getDb } from "@/db/client";
import {
  deleteLocation,
  setLocationArchived,
  updateLocation,
} from "@/db/mutations/setup";
import { parseId, parseJson, route } from "@/lib/http";
import {
  archiveInputSchema,
  locationInputSchema,
} from "@/lib/validation/setup";

type Params = { id: string };

export const PUT = route<Params>("mutation", async (request, { id }) =>
  updateLocation(
    await getDb(),
    parseId(id),
    await parseJson(request, locationInputSchema),
  ),
);

export const PATCH = route<Params>("mutation", async (request, { id }) => {
  const { archived } = await parseJson(request, archiveInputSchema);
  return setLocationArchived(await getDb(), parseId(id), archived);
});

export const DELETE = route<Params>("mutation", async (_request, { id }) =>
  deleteLocation(await getDb(), parseId(id)),
);
