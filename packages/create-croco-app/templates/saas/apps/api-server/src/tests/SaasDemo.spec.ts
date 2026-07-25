import { Container } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { JobsController } from "../controllers/JobsController";
import { assertDemoEndpointsEnabled, SaasController } from "../controllers/SaasController";
import { saasDemoSnapshotSchema } from "../controllers/schemas";
import { DemoEndpointDisabledProblem } from "../problems";
import {
  getSaasProviderProfile,
  isSaasDemoEndpointEnabled,
  SAAS_DEMO_ENDPOINTS_ENABLED_ENV,
} from "../providerProfiles";
import {
  assertSaasDemoSnapshot,
  createSaasRuntime,
  runSaasDemoFlow,
  seedDefaultSaasRuntime,
} from "../saasDemo";

describe("SaaS golden path demo", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("creates tenant and owner membership", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.tenant.slug).toBe("acme");
    expect(snapshot.tenant.status).toBe("trial");
    expect(snapshot.membership.ownerRole).toBe("owner");
    expect(snapshot.contract).toEqual({
      version: "saas-smoke-contract/v1",
      providerProfile: "in-memory",
    });
  });

  it("creates invitation and member membership", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.invitation.status).toBe("accepted");
    expect(snapshot.invitation.invitedUserId).toBe("user_member");
    expect(snapshot.membership.memberRole).toBe("member");
    expect(snapshot.membership.memberCount).toBe(2);
  });

  it("enforces membership seats from entitlement quota", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.membership.seatLimit).toMatchObject({
      quota: 2,
      usage: 3,
      exceeded: true,
      remaining: 0,
      failureCode: "SEAT_LIMIT_EXCEEDED",
      rejectedUserId: "user_over_limit",
    });
  });

  it("allows configured permission for invited member", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.auth).toEqual({
      userId: "user_member",
      sessionId: "session_demo_member",
      roles: ["member"],
      permission: "tenant:read",
      allowed: true,
    });
    expect(snapshot.access.allowed).toBe(true);
  });

  it("records usage for tenant", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.metering).toMatchObject({
      meterId: "api_requests",
      recordedValue: 3,
      currentUsage: 3,
    });
  });

  it("records AI usage and blocks over-quota LLM usage", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.ai).toMatchObject({
      provider: "in-memory",
      modelId: "demo-assistant",
      responseText: "Usage is under control.",
      promptQuota: 50,
      quotaFailureCode: "llm-metering/quota-exceeded",
    });
    expect(snapshot.ai.promptUsage).toBe(snapshot.ai.promptTokens);
    expect(snapshot.ai.totalTokens).toBe(snapshot.ai.promptTokens + snapshot.ai.completionTokens);
    expect(snapshot.ai.costUsd).toBeGreaterThan(0);
  });

  it("returns entitlement status after usage is recorded", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.entitlement).toMatchObject({
      featureKey: "api.requests",
      granted: true,
      quota: 100,
      usage: 3,
      remaining: 97,
      planId: "team",
    });
    expect(snapshot.billing.entitlementPlanId).toBe("team");
    expect(snapshot.billing.mockEvent).toMatchObject({
      eventId: "billing.subscription_activated:tenant_acme:team",
      eventType: "billing.subscription_activated",
      externalSubscriptionId: "external_subscription_tenant_acme",
      planVersionRef: "team@v1",
      processedStatus: "completed",
      duplicateFailureCode: "billing/webhook-already-processed",
    });
  });

  it("seeds dashboard-ready normal and over-quota usage states", async () => {
    const runtime = createSaasRuntime();
    const snapshot = await runSaasDemoFlow(runtime);

    const meters = await runtime.meterRegistry.getByTenant(snapshot.tenant.id);
    const storageUsage = await runtime.meteringService.getUsage({
      tenantId: snapshot.tenant.id,
      meterId: "storage_gb",
      period: "billing_cycle",
    });
    const storageEntitlement = await runtime.entitlementManager.check(
      snapshot.tenant.id,
      "storage.gb",
    );

    expect(meters.map((meter) => meter.meterId).sort()).toEqual([
      "api_requests",
      "llm.completion_tokens",
      "llm.cost_usd",
      "llm.prompt_tokens",
      "storage_gb",
    ]);
    expect(meters.find((meter) => meter.meterId === "api_requests")?.metadata).toMatchObject({
      featureKey: "api.requests",
      unit: "request",
    });
    expect(meters.find((meter) => meter.meterId === "storage_gb")?.metadata).toMatchObject({
      featureKey: "storage.gb",
      unit: "GB",
    });
    expect(meters.find((meter) => meter.meterId === "llm.prompt_tokens")?.metadata).toMatchObject({
      provider: "in-memory",
      unit: "token",
    });
    expect(
      meters.find((meter) => meter.meterId === "llm.completion_tokens")?.metadata,
    ).toMatchObject({
      provider: "in-memory",
      unit: "token",
    });
    expect(meters.find((meter) => meter.meterId === "llm.cost_usd")?.metadata).toMatchObject({
      provider: "in-memory",
      unit: "usd",
    });
    expect(storageUsage).toBe(105);
    expect(storageEntitlement).toMatchObject({
      featureKey: "storage.gb",
      granted: true,
      quota: 100,
      usage: 105,
      remaining: 0,
      exceeded: true,
      overagePolicy: "WARN",
    });
  });

  it("exposes health and diagnostics endpoints", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.operations).toEqual({
      healthStatus: "up",
      diagnosticsSummary: "all_healthy",
    });
    expect(() => assertSaasDemoSnapshot(snapshot)).not.toThrow();
  });

  it("keeps lifecycle evidence in the demo response contract", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());
    const parsed = saasDemoSnapshotSchema.parse(snapshot);

    expect(parsed.lifecycle).toMatchObject({
      ruleId: "saas-risk-onboarding-follow-up",
      firstRunStatus: "succeeded",
      duplicateRunStatus: "skipped",
      duplicateSkipReason: "idempotency_key_reused",
      emittedActionType: "cs.follow_up",
      emittedActionCount: 1,
    });
  });

  it("documents supported and provider-backed profile seams", () => {
    expect(getSaasProviderProfile("in-memory")).toMatchObject({
      status: "supported",
      env: expect.arrayContaining([SAAS_DEMO_ENDPOINTS_ENABLED_ENV]),
      commands: expect.arrayContaining(["pnpm demo:smoke"]),
    });
    expect(getSaasProviderProfile("drizzle-polar-upstash")).toMatchObject({
      status: "documented-seam",
      packages: expect.arrayContaining([
        "@croco/billing-polar",
        "@croco/metering-upstash",
        "@croco/ratelimit-upstash",
        "@croco/tasks-qstash",
        "@croco/tx-drizzle",
      ]),
      env: expect.arrayContaining(["DATABASE_URL", "POLAR_ACCESS_TOKEN", "UPSTASH_REDIS_REST_URL"]),
    });
    expect(getSaasProviderProfile("saas-node-postgres")).toMatchObject({
      status: "documented-seam",
      packages: expect.arrayContaining([
        "@croco/auth-better-auth",
        "@croco/billing-polar",
        "@croco/tasks-qstash",
        "@croco/telemetry-sdk-node",
      ]),
      env: expect.arrayContaining(["DATABASE_URL", "POLAR_WEBHOOK_SECRET", "CLOUDINARY_URL"]),
    });
    expect(getSaasProviderProfile("saas-cloudflare")).toMatchObject({
      status: "documented-seam",
      packages: expect.arrayContaining([
        "@croco/transports-cloudflare-workers",
        "@croco/storage-r2",
      ]),
      env: expect.arrayContaining(["CLOUDFLARE_ACCOUNT_ID", "R2_BUCKET", "CLERK_SECRET_KEY"]),
    });
    expect(getSaasProviderProfile("saas-lambda")).toMatchObject({
      status: "documented-seam",
      packages: expect.arrayContaining(["@croco/preset-lambda", "@croco/storage-cloudinary"]),
      env: expect.arrayContaining(["AWS_REGION", "CLERK_SECRET_KEY", "CLOUDINARY_URL"]),
    });
  });

  it("keeps demo endpoints closed unless explicitly enabled outside production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousFlag = process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV];

    try {
      delete process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV];
      process.env.NODE_ENV = "development";
      expect(isSaasDemoEndpointEnabled()).toBe(false);
      await expect(assertDemoEndpointsEnabled()).rejects.toBeInstanceOf(
        DemoEndpointDisabledProblem,
      );

      process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV] = "true";
      expect(isSaasDemoEndpointEnabled()).toBe(true);
      await expect(assertDemoEndpointsEnabled()).resolves.toBeUndefined();

      process.env.NODE_ENV = "production";
      expect(isSaasDemoEndpointEnabled()).toBe(false);
      await expect(assertDemoEndpointsEnabled()).rejects.toBeInstanceOf(
        DemoEndpointDisabledProblem,
      );
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }

      if (previousFlag === undefined) {
        delete process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV];
      } else {
        process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV] = previousFlag;
      }
    }
  });

  it("resets the shared demo runtime before endpoint seeding", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousFlag = process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV];

    try {
      process.env.NODE_ENV = "development";
      process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV] = "true";

      const controller = new SaasController();
      const first = await controller.seedDemo();
      const second = await controller.seedDemo();

      expect(first.tenant.id).toBe("tenant_acme");
      expect(second.tenant.id).toBe("tenant_acme");
      expect(second.billing.mockEvent.duplicateFailureCode).toBe(
        "billing/webhook-already-processed",
      );
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }

      if (previousFlag === undefined) {
        delete process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV];
      } else {
        process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV] = previousFlag;
      }
    }
  });

  it("runs an inspectable billing sync background job", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.jobs).toMatchObject({
      type: "billing-sync",
      status: "completed",
      failurePolicyState: "succeeded",
      logCount: 2,
    });
  });

  it("exposes the billing sync job through operations controller", async () => {
    const seeded = await seedDefaultSaasRuntime();
    const controller = new JobsController();

    const listReport = (await controller.list(undefined, "billing-sync")) as {
      summary: string;
      total: number;
      jobs: readonly { id: string; failurePolicy: { state: string } }[];
    };

    expect(listReport).toMatchObject({
      summary: "healthy",
      total: 1,
      jobs: [
        {
          id: seeded.jobs.id,
          failurePolicy: { state: "succeeded" },
        },
      ],
    });

    const logs = await controller.logs(seeded.jobs.id);

    expect(logs.map((entry) => entry.message)).toEqual([
      "Billing sync started",
      "Billing subscription active",
    ]);
  });
});
