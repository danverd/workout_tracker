import { NextResponse } from "next/server";
import type { z } from "zod";
import { getDb, type Database } from "@/db/client";
import { requireMutationSession, requireSession } from "@/lib/server";
import { idSchema } from "@/lib/validation/setup";
import type { Result } from "@/features/setup/mutations";

export type IdContext = { params: Promise<{ id: string }> };

function respond<T>(result: Result<T>, status = 200) {
  return result.ok
    ? NextResponse.json(result.value, { status })
    : NextResponse.json({ error: result.error }, { status: result.status });
}

/** GET handlers. */
export async function handleRead<T>(run: (db: Database) => Promise<T>) {
  const denied = await requireSession();
  if (denied) return denied;
  return NextResponse.json(await run(await getDb()));
}

/** POST/PUT/PATCH handlers: auth, parse and validate the body, then run. */
export async function handleWrite<S extends z.ZodType>(
  request: Request,
  schema: S,
  run: (db: Database, input: z.output<S>) => Promise<Result<unknown>>,
  successStatus = 200,
) {
  const denied = await requireMutationSession();
  if (denied) return denied;
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    return NextResponse.json(
      { error: `${where}${issue?.message ?? "Invalid request."}` },
      { status: 400 },
    );
  }
  return respond(await run(await getDb(), parsed.data), successStatus);
}

/** DELETE handlers and other body-less mutations. */
export async function handleAction(
  run: (db: Database) => Promise<Result<unknown>>,
) {
  const denied = await requireMutationSession();
  if (denied) return denied;
  return respond(await run(await getDb()));
}

export async function readId(context: IdContext): Promise<string | null> {
  const parsed = idSchema.safeParse((await context.params).id);
  return parsed.success ? parsed.data : null;
}

export const notFound = () =>
  NextResponse.json({ error: "Not found." }, { status: 404 });
