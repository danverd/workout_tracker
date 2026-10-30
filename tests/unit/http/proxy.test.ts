import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "../../../proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie } : undefined,
  });

describe("proxy", () => {
  it("returns 401 JSON for unauthenticated API requests", async () => {
    const response = proxy(request("/api/sessions/x"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("redirects unauthenticated pages to the login page", () => {
    const response = proxy(request("/history"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("only treats the exact /api/session path as public", () => {
    expect(proxy(request("/api/session")).status).toBe(200);
    expect(proxy(request("/api/sessions/x")).status).toBe(401);
    expect(proxy(request("/api/session/other")).status).toBe(401);
    expect(proxy(request("/login")).status).toBe(200);
  });

  it("lets requests with a session cookie through", () => {
    expect(
      proxy(request("/api/sessions/x", "workout_session=token")).status,
    ).toBe(200);
  });
});
