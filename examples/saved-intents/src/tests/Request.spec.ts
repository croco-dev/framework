import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "../request";

afterEach(() => vi.unstubAllGlobals());
describe("request", () => {
  it.each([
    [403, "Forbidden", "saved-intent/denied"],
    [409, "", "saved-intent/conflict"],
    [400, "{", "saved-intent/invalid"],
    [503, "<html>Unavailable</html>", "SAVED_REQUEST_FAILED"],
  ])("preserves status %i without a JSON response", async (status, body, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })));
    await expect(request("/api/list")).rejects.toMatchObject({ code, status });
  });
  it.each(["", "   "])("uses status for unusable Problem code %j", async (code) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status: 403 })),
    );
    await expect(request("/api/list")).rejects.toMatchObject({
      code: "saved-intent/denied",
      status: 403,
    });
  });
  it("preserves the server Problem code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('{"code":"saved-intent/denied"}', { status: 403 })),
    );
    await expect(request("/api/list")).rejects.toMatchObject({
      code: "saved-intent/denied",
      status: 403,
    });
  });
  it("does not disguise a malformed successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    await expect(request("/api/list")).rejects.toBeInstanceOf(SyntaxError);
  });
  it("returns successful JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"ok":true}')));
    await expect(request("/api/list")).resolves.toEqual({ ok: true });
  });
});
