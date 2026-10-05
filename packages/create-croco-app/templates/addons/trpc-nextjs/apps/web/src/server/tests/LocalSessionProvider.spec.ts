import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalSameOrigin, LocalSessionProvider, SESSION_COOKIE } from "../LocalSessionProvider";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("local server sessions", () => {
  it("requires explicit fixture activation and expires server-side identity", async () => {
    vi.useFakeTimers();
    const sessions = new LocalSessionProvider();
    const token = sessions.issue("alice");
    const request = new Request("http://localhost/", {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });
    expect(await sessions.authenticate(request)).toBeNull();
    vi.stubEnv("CROCO_WEB_DEMO", "local");
    expect(await sessions.authenticate(request)).toMatchObject({
      id: "alice",
      tenantId: "studio-a",
    });
    expect(
      await sessions.authenticate(
        new Request("http://localhost/", { headers: { cookie: `${SESSION_COOKIE}=alice` } }),
      ),
    ).toBeNull();
    vi.advanceTimersByTime(3_600_000);
    expect(await sessions.authenticate(request)).toBeNull();
  });

  it("uses the wire host despite Next loopback normalization and rejects cross-origin mutations", () => {
    const request = (host: string | undefined, origin: string) =>
      new Request("http://localhost:3000/api/local-session", {
        headers: { ...(host ? { host } : {}), origin },
      });
    expect(isLocalSameOrigin(request("127.0.0.1:3000", "http://127.0.0.1:3000"))).toBe(true);
    expect(isLocalSameOrigin(request("localhost:3000", "http://localhost:3000"))).toBe(true);
    expect(isLocalSameOrigin(request("127.0.0.1:3000", "http://example.test"))).toBe(false);
    expect(isLocalSameOrigin(request("example.test", "http://example.test"))).toBe(false);
    expect(isLocalSameOrigin(request(undefined, "http://localhost:3000"))).toBe(false);
  });
});
