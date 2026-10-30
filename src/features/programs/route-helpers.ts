import { NextResponse } from "next/server";
import type { z } from "zod";
import { ProgramError } from "@/db/queries/programs";
import { idSchema } from "@/lib/validation/setup";

export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<
  { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }
> {
  const body = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    ),
  };
}

export function parseId(id: string): string | null {
  const parsed = idSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

export const notFound = () =>
  NextResponse.json({ error: "Program not found." }, { status: 404 });

/** Maps ProgramError to its status; anything else to a generic 500. */
export async function handleProgramRoute(
  run: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ProgramError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 },
    );
  }
}
