import { getDb } from "@/db/client";
import { getSettings } from "@/db/queries/setup";
import { updateSettings } from "@/db/mutations/setup";
import { parseJson, route } from "@/lib/http";
import { settingsInputSchema } from "@/lib/validation/setup";

export const GET = route("read", async () => getSettings(await getDb()));

export const PUT = route("mutation", async (request) =>
  updateSettings(await getDb(), await parseJson(request, settingsInputSchema)),
);
