import OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAIClassifier } from "../openai";
import { startLocalProvider } from "../localProvider";
import { createFixture, inputs, limits, scope } from "../fixture";
import { MemoryStore } from "./MemoryStore";
const providers: Awaited<ReturnType<typeof startLocalProvider>>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(providers.splice(0).map((provider) => provider.close()));
});
async function fixture(options: Parameters<typeof startLocalProvider>[0] = {}) {
  const provider = await startLocalProvider(options);
  providers.push(provider);
  const classify = createOpenAIClassifier(
    new OpenAI({ apiKey: "synthetic-only", baseURL: provider.baseURL }),
  );
  const f = createFixture(new MemoryStore(), classify);
  await f.service.enqueueBatch(scope, "sdk", inputs, limits, { rawMs: 100000, resultMs: 200000 });
  return { ...f, provider };
}
describe("native SDK classification contract", () => {
  it("uses structured finite labels, disables retries/storage/tools and maps real HTTP response usage", async () => {
    const f = await fixture();
    const candidate = await f.service.classify(scope, "sdk", "course", "intent", "v1");
    expect(candidate).toMatchObject({
      state: "classified",
      labelId: "purchase",
      modelRef: "fixture-model",
      providerRequestRef: "req-local",
      usage: { kind: "known", inputTokens: 73, outputTokens: 11 },
    });
    expect(f.provider.requests[0]).toMatchObject({
      model: "fixture-model",
      store: false,
      tools: [],
      max_output_tokens: 128,
      text: {
        format: {
          strict: true,
          schema: {
            additionalProperties: false,
            properties: {
              labelId: { anyOf: [{ enum: ["support", "purchase"] }, { type: "null" }] },
            },
          },
        },
      },
    });
    expect(JSON.stringify(f.provider.requests)).not.toContain("synthetic-only");
    expect(JSON.stringify(f.provider.requests)).not.toContain("local-reviewer");
    await f.service.settle(scope, "sdk");
    expect((await f.journal.getDiagnostics()).backlogCount).toBe(1);
    expect(f.provider.requests).toHaveLength(1);
  });
  it.each([
    { output: "{invalid" },
    { output: '{"labelId":"attacker-created"}' },
    { status: "incomplete" },
    { usage: false },
  ])("retains incomplete, invalid and unknown usage evidence: %j", async (options) => {
    const f = await fixture(options);
    const candidate = await f.service.classify(scope, "sdk", "course", "intent", "v1");
    if ("usage" in options) expect(candidate.usage).toEqual({ kind: "unknown" });
    else expect(candidate.state).toBe("unknown");
    await f.service.classify(scope, "sdk", "course", "intent", "v1");
    expect(f.provider.requests).toHaveLength(1);
  });
  it("preserves quota Error.cause without exposing provider messages or repeating HTTP on restart", async () => {
    const f = await fixture({ httpStatus: 429 });
    const problem = await f.service
      .classify(scope, "sdk", "course", "intent", "v1")
      .catch((error) => error);
    expect(problem.cause).toBeInstanceOf(OpenAI.RateLimitError);
    expect(JSON.stringify(problem.toJSON())).not.toContain("synthetic quota failure");
    expect(f.provider.requests).toHaveLength(1);
    expect(await f.service.classify(scope, "sdk", "course", "intent", "v1")).toMatchObject({
      state: "failed",
      usage: { kind: "unknown" },
    });
    expect(f.provider.requests).toHaveLength(1);
  });
  it("cancels a real SDK HTTP request after dispatch and keeps acceptance/usage unknown", async () => {
    const f = await fixture({ hold: true });
    const controller = new AbortController();
    const pending = f.service.classify(scope, "sdk", "course", "intent", "v1", controller.signal);
    await f.provider.firstRequest;
    controller.abort();
    await expect(pending).rejects.toMatchObject({
      code: "analytics-core/enrichment-acceptance-unknown",
    });
    expect(await f.service.classify(scope, "sdk", "course", "intent", "v1")).toMatchObject({
      state: "failed",
      reason: "acceptance-unknown",
    });
    expect(f.provider.requests).toHaveLength(1);
  });
  it.each(["event", "usage"] as const)(
    "retries only the %s sink after native SDK success, with stable event identity",
    async (sink) => {
      const f = await fixture();
      const result = await f.service.classify(scope, "sdk", "course", "intent", "v1");
      const spy =
        sink === "event" ? vi.spyOn(f.eventBus, "publish") : vi.spyOn(f.journal, "append");
      spy.mockRejectedValueOnce(new Error("synthetic private sink failure"));
      const problem = await f.service.settle(scope, "sdk").catch((error) => error);
      expect(problem.code).toBe("analytics-core/enrichment-settlement-failed");
      expect(JSON.stringify(problem.toJSON())).not.toContain("synthetic private sink failure");
      await f.service.settle(scope, "sdk");
      expect(f.provider.requests).toHaveLength(1);
      expect((await f.journal.getDiagnostics()).backlogCount).toBe(1);
      expect(f.events.has(result.receiptId)).toBe(true);
      expect(spy.mock.calls[0][0].eventId).toBe(result.receiptId);
      expect(spy.mock.calls[1][0].eventId).toBe(result.receiptId);
      expect(JSON.stringify(spy.mock.calls)).not.toContain("I want to buy a course");
    },
  );
});
