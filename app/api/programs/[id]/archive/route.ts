import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { setProgramArchived } from "@/db/queries/programs";
import {
  handleProgramRoute,
  notFound,
  parseBody,
  parseId,
} from "@/features/programs/route-helpers";
import { requireMutationSession } from "@/lib/server";
import { archiveInputSchema } from "@/lib/validation/setup";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireMutationSession();
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return notFound();
  return handleProgramRoute(async () => {
    const parsed = await parseBody(request, archiveInputSchema);
    if (!parsed.ok) return parsed.response;
    const program = await setProgramArchived(
      await getDb(),
      id,
      parsed.data.archived,
    );
    return program ? NextResponse.json(program) : notFound();
  });
}
