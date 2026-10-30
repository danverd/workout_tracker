import { getDb } from "@/db/client";
import { loadCatalog } from "@/db/queries/sessions";
import { parseId, route } from "@/lib/http";

/** Preview data: locations, exercises, programs, usage and last sets. */
export const GET = route("read", async (request) => {
  const exclude = new URL(request.url).searchParams.get("exclude");
  return loadCatalog(await getDb(), {
    excludeSessionId: exclude ? parseId(exclude) : undefined,
  });
});
