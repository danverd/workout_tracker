import { getDb } from "@/db/client";
import { getSummary } from "@/db/queries/history";
import { parseQuery, route } from "@/lib/http";
import { summaryQuerySchema } from "@/lib/validation/history";

export const GET = route("read", async (request) =>
  getSummary(await getDb(), parseQuery(request, summaryQuerySchema)),
);
