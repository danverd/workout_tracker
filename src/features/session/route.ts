import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SessionQueryError } from "@/db/queries/sessions";
import { requireMutationSession, requireSession } from "@/lib/server";
import { idSchema } from "@/lib/validation/setup";

/** Parses a JSON request body; an empty body counts as {}. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new SessionQueryError(400, "Invalid JSON.");
  }
}

export function parseId(value: string, label = "id"): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new SessionQueryError(400, `Invalid ${label}.`);
  return parsed.data;
}

/**
 * Wraps a route handler: authenticates (mutations also check the origin),
 * then maps validation and query errors to JSON `{ error }` responses.
 */
export async function guarded(
  kind: "read" | "mutation",
  run: () => Promise<Response>,
): Promise<Response> {
  const denied =
    kind === "read" ? await requireSession() : await requireMutationSession();
  if (denied) return denied;
  try {
    return await run();
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    if (error instanceof SessionQueryError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}

export type IdParams = { params: Promise<{ id: string }> };
export type ExerciseParams = {
  params: Promise<{ id: string; exerciseId: string }>;
};
export type SetParams = {
  params: Promise<{ id: string; exerciseId: string; setId: string }>;
};
