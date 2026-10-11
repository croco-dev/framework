import OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryBillableUsageJournal } from "@croco/metering-core";
import { createFixture } from "../fixture";
import { createOpenAIPlanProposal } from "../openai";
import { startLocalProvider } from "../localProvider";
import { AnalysisSettlementProblem, GrowthAnalysisProblem } from "@croco/analytics-core/runtime";

const providers: Awaited<ReturnType<typeof startLocalProvider>>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(providers.splice(0).map((provider) => provider.close()));
});

async function fixture(options: Parameters<typeof startLocalProvider>[0] = {}) {
  const provider = await startLocalProvider(options);
  providers.push(provider);
  const propose = createOpenAIPlanProposal(
    new OpenAI({ apiKey: "local-only", baseURL: provider.baseURL }),
    "fixture-model",
  );
  return { ...createFixture(propose), provider };
}

describe("native OpenAI SDK plan integration", () => {
  it("recovers a failed usage journal write after actual SDK success without another inference", async () => {
    const cause = new Error("private-usage-sink-cause");
    const append = vi
      .spyOn(InMemoryBillableUsageJournal.prototype, "append")
      .mockRejectedValueOnce(cause);
    const demo = await fixture();
    const problem = await demo.service
      .propose("What is September activation?")
      .catch((error) => error);
    expect(problem).toBeInstanceOf(AnalysisSettlementProblem);
    expect(problem.cause).toBe(cause);
    expect(JSON.stringify(problem.toJSON())).not.toContain("private-usage-sink-cause");
    expect(demo.provider.requests).toHaveLength(1);
    expect(demo.executions()).toBe(0);
    const proposal = await problem.resume();
    expect(proposal).toMatchObject({
      status: "confirmation",
      usage: { kind: "known", inputTokens: 100, outputTokens: 10 },
    });
    expect(append).toHaveBeenCalledTimes(2);
    expect(append.mock.calls[1]).toEqual(append.mock.calls[0]);
    expect(append.mock.calls[0][0]).toMatchObject({
      value: 110,
      dimensions: { completion: "complete" },
    });
    expect((await demo.journal.getDiagnostics()).backlogCount).toBe(1);
    expect(demo.provider.requests).toHaveLength(1);
    const outcome = await demo.service.execute(proposal.choices[0].plan);
    expect(outcome).toMatchObject({
      status: "ready",
      answer: { source: "report", facts: [{ value: "0.42" }] },
    });
    expect(demo.provider.requests).toHaveLength(1);
    expect(demo.executions()).toBe(0);
  });
  it.each([
    ["failed", "analytics-core/analysis-provider-failed"],
    ["cancelled", "analytics-core/analysis-cancelled"],
    ["queued", "analytics-core/analysis-provider-failed"],
    ["in_progress", "analytics-core/analysis-provider-failed"],
  ])(
    "preserves %s failure evidence and supplied usage without another SDK call",
    async (status, code) => {
      const demo = await fixture({
        status,
        error: { code: "provider_failure", message: "private-provider-cause" },
      });
      const problem = await demo.service
        .propose("What is September activation?")
        .catch((error) => error);
      expect(problem).toBeInstanceOf(GrowthAnalysisProblem);
      expect(problem.code).toBe(code);
      expect(problem.cause.message).toBe("private-provider-cause");
      expect(JSON.stringify(problem.toJSON())).not.toContain("private-provider-cause");
      expect(demo.provider.requests).toHaveLength(1);
      expect((await demo.journal.getDiagnostics()).backlogCount).toBe(1);
      expect(demo.executions()).toBe(0);
    },
  );

  it("distinguishes incomplete response and invalid JSON without fabricating an answer", async () => {
    const truncated = await fixture({ status: "incomplete" });
    expect(await truncated.service.propose("What is September activation?")).toMatchObject({
      status: "unavailable",
      reason: "truncated",
    });
    const invalid = await fixture();
    await expect(invalid.service.propose("Activation invalid-json")).rejects.toMatchObject({
      code: "analytics-core/analysis-invalid-json",
    });
    expect(invalid.executions()).toBe(0);
  });
  it("uses Responses structured selection and the common report without another query", async () => {
    const demo = await fixture();
    const proposal = await demo.service.propose("What is September activation?");
    expect(proposal.status).toBe("confirmation");
    if (proposal.status !== "confirmation") throw new Error("Expected concrete plan");
    expect(proposal.usage).toEqual({ kind: "known", inputTokens: 100, outputTokens: 10 });
    const answer = await demo.service.execute(proposal.choices[0].plan);
    expect(answer.status).toBe("ready");
    if (answer.status !== "ready") throw new Error("Expected result");
    expect(answer.answer).toMatchObject({
      facts: [{ label: "Activation rate", value: "0.42" }],
      numerator: "42",
      denominator: "100",
      source: "report",
      sourceRefs: ["activation-snapshot"],
    });
    expect(demo.executions()).toBe(0);
    expect(demo.provider.requests).toHaveLength(1);
    expect(demo.provider.requests[0]).toMatchObject({
      store: false,
      tools: [],
      max_output_tokens: 128,
      text: {
        format: { type: "json_schema", strict: true, schema: { additionalProperties: false } },
      },
    });
    const transmitted = String(demo.provider.requests[0].input);
    expect(transmitted).not.toContain("synthetic-tenant");
    expect(transmitted).not.toContain("synthetic-operator");
    expect(transmitted).not.toContain("0.42");
  });

  it("blocks PII before SDK transmission and preserves ambiguity as choices", async () => {
    const demo = await fixture();
    await expect(demo.service.propose("Activation for user@example.test")).rejects.toMatchObject({
      code: "analytics-core/analysis-question-blocked",
    });
    expect(demo.provider.requests).toHaveLength(0);
    const proposal = await demo.service.propose("Ambiguous activation?");
    expect(proposal.status).toBe("confirmation");
    if (proposal.status === "confirmation") expect(proposal.choices).toHaveLength(2);
    expect(demo.executions()).toBe(0);
  });

  it("cancels the actual SDK HTTP request without retrying inference", async () => {
    const demo = await fixture();
    const abort = new AbortController();
    const pending = demo.service.propose("Slow activation?", abort.signal);
    await new Promise((resolve) => setTimeout(resolve, 100));
    abort.abort();
    await expect(pending).rejects.toMatchObject({ code: "analytics-core/analysis-cancelled" });
    expect(demo.provider.requests).toHaveLength(1);
  });
});
