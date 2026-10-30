import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { requireMutationSession, requireSession } from "@/lib/server";
import { idSchema } from "@/lib/validation/setup";

/** An error that maps directly to a JSON `{ error }` response. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

type Handled = Response | object | null;

/**
 * Wraps a route handler: authenticates (mutations also check the origin),
 * then maps HttpError and ZodError to JSON `{ error }` responses. Handlers
 * return a Response, or any JSON-serialisable value sent with status 200.
 */
export function route<P extends Record<string, string> = Record<string, never>>(
  kind: "read" | "mutation",
  handler: (request: Request, params: P) => Promise<Handled>,
) {
  return async (
    request: Request,
    context: { params: Promise<P> },
  ): Promise<Response> => {
    try {
      if (kind === "read") await requireSession();
      else await requireMutationSession();
      const result = await handler(request, await context.params);
      return result instanceof Response ? result : NextResponse.json(result);
    } catch (error) {
      if (error instanceof HttpError)
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      if (error instanceof ZodError)
        return NextResponse.json(
          { error: error.issues[0]?.message ?? "Invalid request." },
          { status: 400 },
        );
      console.error(error);
      return NextResponse.json(
        { error: "Something went wrong." },
        { status: 500 },
      );
    }
  };
}

/** Parses a JSON request body; an empty body counts as {}. */
export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  const text = await request.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new HttpError(400, "Invalid JSON.");
    }
  }
  return schema.parse(body);
}

/** Validates the URL query string against a schema. */
export function parseQuery<S extends z.ZodType>(
  request: Request,
  schema: S,
): z.output<S> {
  return schema.parse(Object.fromEntries(new URL(request.url).searchParams));
}

export function parseId(value: string, label = "id"): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, `Invalid ${label}.`);
  return parsed.data;
}

export const created = (value: object) =>
  NextResponse.json(value, { status: 201 });
export const noContent = () => new NextResponse(null, { status: 204 });
