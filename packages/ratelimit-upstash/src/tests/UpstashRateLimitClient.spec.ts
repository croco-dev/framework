import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpstashRateLimitClient, MissingUpstashRateLimitConfigProblem } from "../index";
import { UpstashRateLimitUpstreamProblem } from "../libs/problems/RateLimitUpstashProblems";

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

describe("Upstream error cause boundary", () => {
  it("preserves redacted Error diagnostics without retaining upstream payloads (1)", () => {
    const cause = Object.assign(new Error("token=cause-secret"), {
      status: 503,
      response: { headers: { authorization: "Bearer private-header" } },
      nested: new Error("private-nested-cause"),
    });
    cause.stack = "Error: token=cause-secret\n    at request (upstream-sdk.js:17:9)";
    const problem = new UpstashRateLimitUpstreamProblem("eval", cause);
    expect(problem.cause).toBeInstanceOf(Error);
    expect(problem.cause?.stack).toContain("upstream-sdk.js:17:9");
    expect(problem.cause).not.toBe(cause);
    expect(problem.cause?.message).toBe("token=[Redacted]");
    expect(problem.cause?.stack).toContain("token=[Redacted]");
    expect(problem.cause).not.toHaveProperty("response");
    expect(problem.cause).not.toHaveProperty("nested");
    expect(cause.message).toBe("token=cause-secret");
    expect(cause.stack).toContain("token=cause-secret");
    expect(Object.getOwnPropertyDescriptor(problem, "cause")?.enumerable).toBe(false);
    expect(problem.extensions).toMatchObject({ upstreamStatus: 503 });
    for (const serialized of [JSON.stringify(problem), JSON.stringify({ ...problem })]) {
      expect(serialized).not.toContain("cause-secret");
      expect(serialized).not.toContain("private-header");
      expect(serialized).not.toContain("private-nested-cause");
    }
    expect(problem.toJSON()).not.toHaveProperty("cause");
  });
  it("does not promote non-Error input to a cause (1)", () => {
    const problem = new UpstashRateLimitUpstreamProblem("eval", {
      status: 503,
      message: "unavailable",
    });
    expect(problem.cause).toBeUndefined();
    expect(problem.toJSON()).not.toHaveProperty("cause");
  });
});
