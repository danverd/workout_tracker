import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { createProgram, listPrograms } from "@/db/queries/programs";
import {
  handleProgramRoute,
  parseBody,
} from "@/features/programs/route-helpers";
import { requireMutationSession, requireSession } from "@/lib/server";
import { programSaveSchema } from "@/lib/validation/programs";

export async function GET(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const includeArchived =
    new URL(request.url).searchParams.get("archived") === "1";
  return NextResponse.json(
    await listPrograms(await getDb(), { includeArchived }),
  );
}

export async function POST(request: Request) {
  const denied = await requireMutationSession();
  if (denied) return denied;
  return handleProgramRoute(async () => {
    const parsed = await parseBody(request, programSaveSchema);
    if (!parsed.ok) return parsed.response;
    const program = await createProgram(await getDb(), parsed.data);
    return NextResponse.json(program, { status: 201 });
  });
}
