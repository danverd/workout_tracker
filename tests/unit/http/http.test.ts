import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const server = vi.hoisted(() => ({
  requireSession: vi.fn(),
  requireMutationSession: vi.fn(),
}));
vi.mock("@/lib/server", () => server);

import { HttpError, parseId, parseJson, parseQuery, route } from "@/lib/http";

const request = (body?: string) =>
  new Request("http://localhost/api/x?limit=5", { method: "POST", body });

const noParams = { params: Promise.resolve({}) };

beforeEach(() => {
  server.requireSession.mockReset().mockResolvedValue(undefined);
  server.requireMutationSession.mockReset().mockResolvedValue(undefined);
});

describe("route", () => {
  it("serialises returned values as JSON", async () => {
    const handler = route("read", async () => ({ ok: true }));
    const response = await handler(request(), noParams);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(server.requireSession).toHaveBeenCalled();
    expect(server.requireMutationSession).not.toHaveBeenCalled();
  });

  it("passes through Response objects and awaits route params", async () => {
    const handler = route<{ id: string }>("mutation", async (_r, { id }) =>
      Response.json({ id }, { status: 201 }),
    );
    const response = await handler(request(), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "abc" });
    expect(server.requireMutationSession).toHaveBeenCalled();
  });

  it("maps HttpError to its status", async () => {
    const response = await route("read", async () => {
      throw new HttpError(404, "Nope.");
    })(request(), noParams);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Nope." });
  });

  it("returns auth failures without running the handler", async () => {
    server.requireSession.mockRejectedValue(new HttpError(401, "Unauthorized"));
    const handler = vi.fn();
    const response = await route("read", handler)(request(), noParams);
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("maps ZodError to 400 with the first message", async () => {
    const response = await route("mutation", async (req) =>
      parseJson(
        req,
        z.object({ name: z.string().min(1, "Name is required.") }),
      ),
    )(request(JSON.stringify({ name: "" })), noParams);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Name is required." });
  });

  it("maps unknown errors to a generic 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await route("read", async () => {
      throw new Error("boom");
    })(request(), noParams);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Something went wrong." });
    spy.mockRestore();
  });
});

describe("parsers", () => {
  it("parseJson treats an empty body as {} and rejects bad JSON", async () => {
    expect(await parseJson(request(), z.object({}))).toEqual({});
    await expect(parseJson(request("{"), z.object({}))).rejects.toMatchObject({
      status: 400,
      message: "Invalid JSON.",
    });
  });

  it("parseQuery validates search params", () => {
    const schema = z.object({ limit: z.coerce.number() });
    expect(parseQuery(request(), schema)).toEqual({ limit: 5 });
  });

  it("parseId accepts uuids and rejects other values with 400", () => {
    const id = crypto.randomUUID();
    expect(parseId(id)).toBe(id);
    expect(() => parseId("not-an-id")).toThrow(HttpError);
    expect(() => parseId("nope", "session id")).toThrowError(
      "Invalid session id.",
    );
  });
});
