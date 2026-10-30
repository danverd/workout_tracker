import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getProgram, saveProgram } from "@/db/queries/programs";
import {
  handleProgramRoute,
  notFound,
  parseBody,
  parseId,
} from "@/features/programs/route-helpers";
import { requireMutationSession, requireSession } from "@/lib/server";
import { programSaveSchema } from "@/lib/validation/programs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const denied = await requireSession();
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const program = await getProgram(await getDb(), id);
  return program ? NextResponse.json(program) : notFound();
}

export async function PUT(request: Request, { params }: Context) {
  const denied = await requireMutationSession();
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return notFound();
  return handleProgramRoute(async () => {
    const parsed = await parseBody(request, programSaveSchema);
    if (!parsed.ok) return parsed.response;
    const program = await saveProgram(await getDb(), id, parsed.data);
    return program ? NextResponse.json(program) : notFound();
  });
}
