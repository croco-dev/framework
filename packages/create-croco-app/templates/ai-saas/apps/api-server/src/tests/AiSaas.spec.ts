import { rm } from "node:fs/promises";

import { RuntimeContainer as Container, Token } from "@croco/framework-context";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AiRateLimitExceededProblem, AiTenantRequiredProblem } from "../aiProblems";
import { createCrocoApp } from "../app";
import {
  AI_PLAN_CATALOG,
  AI_SAAS_RUNTIME_TOKEN,
  buildAiIdempotencyKey,
  createAiSaasRuntime,
  DEFAULT_AI_MODEL_ID,
  getAiProviderProfile,
  runAiSaasDemoFlow,
  seedAiSaasTenant,
} from "../aiSaas";
import { assertAiSaasSmokeContract } from "../demo/aiSmokeContract";
import { SAAS_DEMO_ENDPOINTS_ENABLED_ENV } from "../providerProfiles";

const usageStateDirectory = vi.hoisted(() => {
  const environmentName = "CROCO_DEMO_USAGE_STATE_DIR";
  const previous = process.env[environmentName];
  const temporaryRoot = process.env.TEMP ?? process.env.TMP ?? process.env.TMPDIR ?? "/tmp";
  const directory = `${temporaryRoot}/croco-ai-saas-${process.pid}-${Date.now()}`;
  process.env[environmentName] = directory;
  return { directory, previous };
});

afterAll(async () => {
  try {
    await rm(usageStateDirectory.directory, { force: true, recursive: true });
  } finally {
    restoreEnvironment("CROCO_DEMO_USAGE_STATE_DIR", usageStateDirectory.previous);
  }
});

describe("AI SaaS generated baseline", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("generates deterministic text and records canonical token and cost usage", async () => {
    const snapshot = await runAiSaasDemoFlow(createAiSaasRuntime());

    if (snapshot.generation.usage.state !== "known") throw new Error("Expected known demo usage");
    expect(snapshot.generation.modelId).toBe(DEFAULT_AI_MODEL_ID);
    expect(snapshot.generation.usage.inputTokens).toBeGreaterThan(0);
    expect(snapshot.generation.usage.outputTokens).toBeGreaterThan(0);
    expect(snapshot.generation.costUsd).toBeGreaterThan(0);
    expect(snapshot.usage.usage.promptTokens).toBe(snapshot.generation.usage.inputTokens);
    expect(snapshot.usage.usage.completionTokens).toBe(snapshot.generation.usage.outputTokens);
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
      status: "supported",
      packages: expect.arrayContaining(["openai"]),
    });
  });

  it("serves AI routes from the application-scoped SaaS provider graph", async () => {
    const previousDemo = process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV];
    process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV] = "true";
    let app: Awaited<ReturnType<typeof createCrocoApp>> | undefined;

    try {
      app = await createCrocoApp({ profileMode: "zero-credential" });
      const seedResponse = await app.fetch(
        new Request("http://localhost/saas/demo/seed", { method: "POST" }),
      );
      expect(seedResponse.status).toBe(200);
      const seed = (await seedResponse.json()) as { readonly tenant: { readonly id: string } };
      const generateResponse = await app.fetch(
        new Request("http://localhost/ai/generate", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-tenant-id": seed.tenant.id,
          },
          body: JSON.stringify({
            requestId: "application-scoped-ai-route",
            prompt: "Draft a short tenant onboarding email.",
          }),
        }),
      );
      const applicationAiRuntime = app.applicationRuntime.get(AI_SAAS_RUNTIME_TOKEN);

      expect(AI_SAAS_RUNTIME_TOKEN).toBeInstanceOf(Token);
      expect(app.applicationRuntime.get(AI_SAAS_RUNTIME_TOKEN)).toBe(applicationAiRuntime);
      expect(generateResponse.status).toBe(200);
      await expect(
        applicationAiRuntime.service.listInvocationLogs(seed.tenant.id),
      ).resolves.toHaveLength(1);

      const secondSeedResponse = await app.fetch(
        new Request("http://localhost/saas/demo/seed", { method: "POST" }),
      );
      expect(secondSeedResponse.status).toBe(200);
      const secondSeed = (await secondSeedResponse.json()) as {
        readonly tenant: { readonly id: string };
      };
      const secondGenerateResponse = await app.fetch(
        new Request("http://localhost/ai/generate", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-tenant-id": secondSeed.tenant.id,
          },
          body: JSON.stringify({
            requestId: "application-scoped-ai-route-after-reset",
            prompt: "Draft a second tenant onboarding email.",
          }),
        }),
      );
      expect(secondGenerateResponse.status).toBe(200);
      const replacementAiRuntime = app.applicationRuntime.get(AI_SAAS_RUNTIME_TOKEN);
      expect(replacementAiRuntime).not.toBe(applicationAiRuntime);
      await expect(
        replacementAiRuntime.service.listInvocationLogs(secondSeed.tenant.id),
      ).resolves.toHaveLength(1);
      await expect(
        applicationAiRuntime.service.listInvocationLogs(seed.tenant.id),
      ).resolves.toHaveLength(1);
    } finally {
      try {
        await app?.disposeApplicationRuntime();
      } finally {
        restoreEnvironment(SAAS_DEMO_ENDPOINTS_ENABLED_ENV, previousDemo);
      }
    }
  }, 90_000);
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
