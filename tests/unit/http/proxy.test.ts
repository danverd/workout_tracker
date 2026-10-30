// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { createSession } from "@/lib/auth";
import { proxy } from "../../../proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie } : undefined,
  });

const status = async (path: string, cookie?: string) =>
  (await proxy(request(path, cookie))).status;

describe("proxy", () => {
  beforeAll(() => {
    process.env.SESSION_SECRET ??= "test-secret-for-proxy-unit-tests-only";
  });

  it("returns 401 JSON for unauthenticated API requests", async () => {
    const response = await proxy(request("/api/sessions/x"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("redirects unauthenticated pages to the login page", async () => {
    const response = await proxy(request("/history"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("only treats the exact /api/session path as public", async () => {
    expect(await status("/api/session")).toBe(200);
    expect(await status("/api/sessions/x")).toBe(401);
    expect(await status("/api/session/other")).toBe(401);
    expect(await status("/login")).toBe(200);
  });

  it("rejects a session cookie whose token is not validly signed", async () => {
    expect(await status("/api/sessions/x", "workout_session=token")).toBe(401);
    expect(await status("/history", "workout_session=token")).toBe(307);
  });

  it("lets requests with a valid session token through", async () => {
    const cookie = `workout_session=${await createSession()}`;
    expect(await status("/api/sessions/x", cookie)).toBe(200);
    expect(await status("/history", cookie)).toBe(200);
  });
});
