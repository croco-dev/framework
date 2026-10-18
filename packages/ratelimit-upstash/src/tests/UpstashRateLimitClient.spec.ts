import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpstashRateLimitClient, MissingUpstashRateLimitConfigProblem } from "../index";

afterEach(() => vi.unstubAllGlobals());

describe("explicit Upstash REST client", () => {
  it.each([
    "",
    "http://redis.fixture",
    "https://user:password@redis.fixture",
    "https://redis.fixture/path",
    "https://redis.fixture/?token=secret",
    "https://redis.fixture/#secret",
  ])("rejects unsafe endpoint %s before fetching", (url) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(() => createUpstashRateLimitClient({ url, token: "secret" })).toThrow(
      MissingUpstashRateLimitConfigProblem,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["", "  ", "token\r\nHeader: value", 42 as unknown as string])(
    "rejects unusable credentials",
    (token) => {
      expect(() => createUpstashRateLimitClient({ url: "https://redis.fixture", token })).toThrow(
        MissingUpstashRateLimitConfigProblem,
      );
    },
  );
  it("sends mutation once after a lost response and omits sensitive transport errors", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new Error("https://secret.fixture unlabelled-secret"));
    vi.stubGlobal("fetch", fetcher);
    const client = createUpstashRateLimitClient({
      url: "https://redis.fixture",
      token: "unlabelled-secret",
    });
    await expect(client.incrbyfloat("counter", 2.5)).rejects.toMatchObject({
      code: "ratelimit-upstash/upstream-failed",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    try {
      await client.get("key");
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain("unlabelled-secret");
      expect(JSON.stringify(error)).not.toContain("secret.fixture");
    }
  });
  it.each([
    ["not-json", true],
    ['{"error":"unlabelled-secret"}', false],
    ["{}", true],
  ])("normalizes malformed/provider response %s", async (body, retryable) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    const client = createUpstashRateLimitClient({ url: "https://redis.fixture", token: "secret" });
    await expect(client.get("key")).rejects.toMatchObject({
      code: "ratelimit-upstash/upstream-failed",
      extensions: expect.objectContaining({ retryable }),
    });
  });
  it("preserves read-your-writes tokens across sequential counter commands", async () => {
    let calls = 0;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      if (calls === 1) {
        return Response.json({ result: "2.5" }, { headers: { "upstash-sync-token": "commit-17" } });
      }
      const expectedToken = calls === 2 ? "commit-17" : "commit-23";
      const token = new Headers(init?.headers).get("upstash-sync-token");
      return Response.json(
        { result: token === expectedToken ? "2.5" : "0" },
        {
          headers: { "upstash-sync-token": "commit-23" },
        },
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const client = createUpstashRateLimitClient({ url: "https://redis.fixture", token: "secret" });
    expect(await client.incrbyfloat("counter", 2.5)).toBe(2.5);
    expect(await client.get<number>("counter")).toBe(2.5);
    expect(await client.get<number>("counter")).toBe(2.5);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("retains Redis serialization and number results for counters", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"result":"4.25"}'));
    vi.stubGlobal("fetch", fetcher);
    const client = createUpstashRateLimitClient({ url: "https://redis.fixture", token: "secret" });
    expect(await client.incrbyfloat("counter", 1.25)).toBe(4.25);
    expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual(["incrbyfloat", "counter", 1.25]);
  });
});
