import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import {
  CardioConflictError,
  deleteCardio,
  upsertCardio,
} from "@/db/queries/cardio";
import { requireMutationSession } from "@/lib/server";
import { cardioInputSchema } from "@/lib/validation/sessions";
import { idSchema } from "@/lib/validation/setup";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const denied = await requireMutationSession();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = cardioInputSchema.safeParse({ ...body, id });
  if (!idSchema.safeParse(id).success || !parsed.success)
    return NextResponse.json(
      { error: "Invalid cardio entry." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await upsertCardio(await getDb(), parsed.data));
  } catch (error) {
    if (error instanceof CardioConflictError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const denied = await requireMutationSession();
  if (denied) return denied;
  const { id } = await params;
  if (!idSchema.safeParse(id).success)
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  if (!(await deleteCardio(await getDb(), id)))
    return NextResponse.json(
      { error: "Cardio entry not found." },
      { status: 404 },
    );
  return NextResponse.json({ ok: true });
}
