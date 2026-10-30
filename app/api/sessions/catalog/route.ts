import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { loadCatalog } from "@/db/queries/sessions";
import { guarded, parseId } from "@/features/session/route";

/** Preview data: locations, exercises, programs, usage and last sets. */
export function GET(request: Request) {
  return guarded("read", async () => {
    const exclude = new URL(request.url).searchParams.get("exclude");
    return NextResponse.json(
      await loadCatalog(await getDb(), {
        excludeSessionId: exclude ? parseId(exclude) : undefined,
      }),
    );
  });
}
