import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { setActiveProgram } from "@/db/queries/programs";
import {
  handleProgramRoute,
  notFound,
  parseId,
} from "@/features/programs/route-helpers";
import { requireMutationSession } from "@/lib/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireMutationSession();
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return notFound();
  return handleProgramRoute(async () => {
    const program = await setActiveProgram(await getDb(), id);
    return NextResponse.json(program);
  });
}
