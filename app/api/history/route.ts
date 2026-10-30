import { getDb } from "@/db/client";
import { listHistory } from "@/db/queries/history";
import { parseQuery, route } from "@/lib/http";
import { historyListQuerySchema } from "@/lib/validation/history";

export const GET = route("read", async (request) =>
  listHistory(await getDb(), parseQuery(request, historyListQuerySchema)),
);
