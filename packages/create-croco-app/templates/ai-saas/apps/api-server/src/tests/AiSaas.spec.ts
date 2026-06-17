import { Container } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { AiRateLimitExceededProblem, AiTenantRequiredProblem } from "../aiProblems";
import {
  AI_PLAN_CATALOG,
  buildAiIdempotencyKey,
  createAiSaasRuntime,
  DEFAULT_AI_MODEL_ID,
  getAiProviderProfile,
  runAiSaasDemoFlow,
  seedAiSaasTenant,
} from "../aiSaas";
import { assertAiSaasSmokeContract } from "../demo/aiSmokeContract";

describe("AI SaaS generated baseline", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("generates deterministic text and records canonical token and cost usage", async () => {
    const snapshot = await runAiSaasDemoFlow(createAiSaasRuntime());

    expect(snapshot.generation.modelId).toBe(DEFAULT_AI_MODEL_ID);
    expect(snapshot.generation.usage.promptTokens).toBeGreaterThan(0);
    expect(snapshot.generation.usage.completionTokens).toBeGreaterThan(0);
    expect(snapshot.generation.costUsd).toBeGreaterThan(0);
    expect(snapshot.usage.usage.promptTokens).toBe(snapshot.generation.usage.promptTokens);
    expect(snapshot.usage.usage.completionTokens).toBe(snapshot.generation.usage.completionTokens);
    expect(snapshot.usage.usage.costUsd).toBe(snapshot.generation.costUsd);
    expect(snapshot.generation.idempotencyKey).toBe(
      buildAiIdempotencyKey(snapshot.tenant.id, snapshot.request.id),
    );
    expect(() => assertAiSaasSmokeContract(snapshot)).not.toThrow();
  });

  it("keeps eval logs redacted by default", async () => {
    const snapshot = await runAiSaasDemoFlow(createAiSaasRuntime());

    expect(snapshot.evalLog.last.promptMetadata).toMatchObject({
      length: snapshot.request.promptLength,
      rawPromptStored: false,
    });
    expect(snapshot.evalLog.last.responseMetadata).toMatchObject({
      length: snapshot.generation.text.length,
      rawResponseStored: false,
    });
  });

  it("rejects configured quota exhaustion with an explicit Problem", async () => {
    const snapshot = await runAiSaasDemoFlow(createAiSaasRuntime());

    expect(snapshot.quotaFailure).toMatchObject({
      code: "ai-saas/quota-exceeded",
      planId: "free",
    });
  });

  it("rejects configured rate-limit exhaustion with an explicit Problem", async () => {
    const runtime = createAiSaasRuntime();
    const seeded = await seedAiSaasTenant(runtime, "pro", "ai-rate-limit");

    for (let index = 0; index < AI_PLAN_CATALOG.pro.rateLimitPerMinute; index += 1) {
      await runtime.service.generateText({
        tenantId: seeded.tenant.id,
        requestId: `rate-limit-${index}`,
        prompt: "Draft a short tenant onboarding email.",
        modelId: DEFAULT_AI_MODEL_ID,
      });
    }

    await expect(
      runtime.service.generateText({
        tenantId: seeded.tenant.id,
        requestId: "rate-limit-rejected",
        prompt: "Draft a short tenant onboarding email.",
        modelId: DEFAULT_AI_MODEL_ID,
      }),
    ).rejects.toBeInstanceOf(AiRateLimitExceededProblem);
  });

  it("requires tenant identity before generating", async () => {
    const runtime = createAiSaasRuntime();

    await expect(
      runtime.service.generateText({
        tenantId: undefined,
        requestId: "missing-tenant",
        prompt: "Hello",
      }),
    ).rejects.toBeInstanceOf(AiTenantRequiredProblem);
  });

  it("exposes provider adapter seams without requiring live credentials", async () => {
    const runtime = createAiSaasRuntime();
    await seedAiSaasTenant(runtime, "team", "provider-seam");

    expect(getAiProviderProfile("in-memory")).toMatchObject({
      status: "supported",
      env: expect.arrayContaining(["AI_DEFAULT_MODEL_ID"]),
    });
    expect(getAiProviderProfile("openai")).toMatchObject({
      status: "documented-seam",
      env: expect.arrayContaining(["OPENAI_API_KEY"]),
    });
    expect(getAiProviderProfile("anthropic")).toMatchObject({
      status: "documented-seam",
      env: expect.arrayContaining(["ANTHROPIC_API_KEY"]),
    });
  });
});
