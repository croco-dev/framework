import { Container } from "typedi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CheckoutResult } from "@croco/billing-core";
import { EventPublisher } from "@croco/events-core";
import { Container as CrocoContainer, LOGGER_TOKEN } from "@croco/framework-context";
import type { ILogger } from "@croco/framework-context";
import { InMemoryIdempotencyStore } from "@croco/idempotency-core";
import { DuplicateRecordProblem, IdempotencyManager } from "@croco/metering-core";
import type { PendingMeteringDelivery } from "@croco/metering-core";
import { createCrocoApp } from "../app";
import { JobsController } from "../controllers/JobsController";
import { assertDemoEndpointsEnabled, SaasController } from "../controllers/SaasController";
import { saasDemoSnapshotSchema } from "../controllers/schemas";
import { InMemoryRedisClient } from "../inMemoryAdapters";
import { DemoEndpointDisabledProblem } from "../problems";
import {
  getSaasProviderProfile,
  isSaasDemoEndpointEnabled,
  SAAS_DEMO_ENDPOINTS_ENABLED_ENV,
} from "../providerProfiles";
import {
  assertSaasDemoSnapshot,
  createSaasRuntime,
  createSaasDemoRuntime,
  DemoBillingGateway,
  runSaasDemoFlow,
  seedDefaultSaasRuntime,
} from "../saasDemo";

describe("SaaS golden path demo", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("deduplicates concurrent membership event relay calls", async () => {
    let releasePublication!: () => void;
    const publicationBlocked = new Promise<void>((resolve) => {
      releasePublication = resolve;
    });
    const publishNow = vi
      .spyOn(EventPublisher.prototype, "publishNow")
      .mockImplementation(() => publicationBlocked);
    try {
      const runtime = createSaasDemoRuntime();
      await runtime.membershipStore.execute({
        operation: "add",
        idempotencyKey: "member:add:concurrent-relay",
        membershipId: "membership-concurrent-relay",
        tenantId: "tenant-concurrent-relay",
        userId: "user-concurrent-relay",
        role: "member",
        maxSeats: null,
      });

      const firstRelay = runtime.membershipManager.publishPendingEvents();
      const secondRelay = runtime.membershipManager.publishPendingEvents();
      await vi.waitFor(() => expect(publishNow).toHaveBeenCalledTimes(1));
      releasePublication();

      await expect(Promise.all([firstRelay, secondRelay])).resolves.toEqual([1, 1]);
    } finally {
      releasePublication();
      publishNow.mockRestore();
    }
  });

  it("replays pending metering delivery state without changing its operation identity", async () => {
    const manager = new IdempotencyManager(new InMemoryRedisClient());
    const firstClaim = await manager.claimMeteringProcessingOrThrow(
      "tenant-1",
      "api_requests",
      "request-1",
    );
    const delivery: PendingMeteringDelivery = {
      usageRecord: {
        id: firstClaim.operationId,
        tenantId: "tenant-1",
        meterId: "api_requests",
        value: 1,
        timestamp: new Date().toISOString(),
        idempotencyKey: "request-1",
      },
    };

    await manager.markMeteringEventsPublishing(
      "tenant-1",
      "api_requests",
      "request-1",
      firstClaim.token,
      delivery,
    );
    await manager.releaseMeteringEvents("tenant-1", "api_requests", "request-1", firstClaim.token);

    const replayClaim = await manager.claimMeteringProcessingOrThrow(
      "tenant-1",
      "api_requests",
      "request-1",
    );
    expect(replayClaim.operationId).toBe(firstClaim.operationId);
    expect(replayClaim.delivery).toEqual(delivery);

    await manager.completeMeteringProcessing(
      "tenant-1",
      "api_requests",
      "request-1",
      replayClaim.token,
    );
    const duplicateClaim = manager.claimMeteringProcessingOrThrow(
      "tenant-1",
      "api_requests",
      "request-1",
    );
    await expect(duplicateClaim).rejects.toThrow(DuplicateRecordProblem);
    await expect(duplicateClaim).rejects.toMatchObject({ code: "metering/duplicate-record" });
  });

  it("keeps demo checkout sessions distinct and shareable across runtimes", async () => {
    const billingGateway = new DemoBillingGateway();
    const checkoutIdempotencyStore = new InMemoryIdempotencyStore<CheckoutResult>();
    const firstRuntime = createSaasRuntime({ billingGateway, checkoutIdempotencyStore });
    const secondRuntime = createSaasRuntime({ billingGateway, checkoutIdempotencyStore });
    const baseParams = {
      billingAccountId: "tenant-1",
      email: "owner@example.com",
      productId: "team",
      successUrl: "https://example.com/success",
    };

    const first = await billingGateway.createCheckout({
      ...baseParams,
      idempotencyKey: "checkout-operation-1",
    });
    const replay = await billingGateway.createCheckout({
      ...baseParams,
      idempotencyKey: "checkout-operation-1",
    });
    const distinct = await billingGateway.createCheckout({
      ...baseParams,
      idempotencyKey: "checkout-operation-2",
    });

    expect(firstRuntime.billingGateway).toBe(billingGateway);
    expect(secondRuntime.billingGateway).toBe(billingGateway);
    expect(replay).toEqual(first);
    expect(distinct.checkoutId).not.toBe(first.checkoutId);
    expect(distinct.checkoutUrl).not.toBe(first.checkoutUrl);
  });

  it("boots through the exported production bootstrap with documented DI validation", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.NODE_ENV = "production";

    try {
      const app = createCrocoApp();
      const response = await app.fetch(new Request("http://localhost/health"));

      expect(response.status).toBe(200);
      expect(app.describeBootstrapValidationPolicy()).toEqual({
        di: "warn",
        security: "enforce",
      });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("DI bootstrap validation failed"));
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Register the missing provider(s)"),
      );
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      warn.mockRestore();
    }
  });

  it("preserves a caller-provided bootstrap logger", () => {
    const logger: ILogger = {
      child: () => logger,
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };
    CrocoContainer.set(LOGGER_TOKEN, logger);

    createCrocoApp();

    expect(CrocoContainer.get(LOGGER_TOKEN)).toBe(logger);
  });

  it("creates tenant and owner membership", async () => {
    const snapshot = await runSaasDemoFlow(createSaasDemoRuntime());

    expect(snapshot.tenant.slug).toBe("acme");
    expect(snapshot.tenant.status).toBe("trial");
    expect(snapshot.membership.ownerRole).toBe("owner");
    expect(snapshot.contract).toEqual({
      version: "saas-smoke-contract/v1",
      providerProfile: "in-memory",
    });
  });

  it("creates invitation and member membership", async () => {
    const snapshot = await runSaasDemoFlow(createSaasDemoRuntime());

    expect(snapshot.invitation.status).toBe("accepted");
    expect(snapshot.invitation.invitedUserId).toBe("user_member");
    expect(snapshot.membership.memberRole).toBe("member");
    expect(snapshot.membership.memberCount).toBe(2);
  });

  it("enforces membership seats from entitlement quota", async () => {
    const snapshot = await runSaasDemoFlow(createSaasDemoRuntime());

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
    const snapshot = await runSaasDemoFlow(createSaasDemoRuntime());

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
    const snapshot = await runSaasDemoFlow(createSaasDemoRuntime());

    expect(snapshot.metering).toMatchObject({
      meterId: "api_requests",
      recordedValue: 3,
      currentUsage: 3,
    });
  });

  it("records AI usage and blocks over-quota LLM usage", async () => {
    const snapshot = await runSaasDemoFlow(createSaasDemoRuntime());

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
    const snapshot = await runSaasDemoFlow(createSaasDemoRuntime());

    expect(snapshot.entitlement).toMatchObject({
      featureKey: "api.requests",
      granted: true,
      quota: 2,
      usage: 3,
      remaining: 0,
      planId: "team",
      planVersionRef: "team@v1",
      overagePolicy: "ALLOW_WITH_OVERAGE",
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

  it("commits billable API usage locally and converges after a retryable provider outage", async () => {
    const snapshot = await runSaasDemoFlow(createSaasDemoRuntime());

    expect(snapshot.billableUsage).toMatchObject({
      planVersionRef: "team@v1",
      journalDurability: "persistent",
      included: {
        eventId: "usage:tenant_acme:api_requests:included:v1",
        value: 2,
        recordOutcome: "recorded",
        deliveryOutcome: "accepted",
        delivery: { accepted: 1, retryableFailed: 0, terminalFailed: 0 },
      },
      overage: {
        eventId: "usage:tenant_acme:api_requests:overage:v1",
        value: 1,
        recordOutcome: "recorded",
        initialDeliveryOutcome: "retryable-failed",
        finalDeliveryOutcome: "accepted",
      },
      providerOutage: {
        delivery: { accepted: 0, retryableFailed: 1, terminalFailed: 0 },
        failureCode: "billing-polar/retryable-upstream",
        backlogCount: 1,
        oldestPendingAgeMs: 1000,
      },
      recovery: {
        command: "pnpm --dir apps/api-server demo:usage-recover",
        processBoundary: "separate-node-process",
        delivery: { accepted: 1, retryableFailed: 0, terminalFailed: 0 },
      },
      replay: {
        eventId: "usage:tenant_acme:api_requests:overage:v1",
        outcome: "duplicate",
        providerAcceptedUsageBefore: 3,
        providerAcceptedUsageAfter: 3,
      },
      providerAcceptedUsage: 3,
      finalConvergence: {
        backlogCount: 0,
        oldestPendingAgeMs: null,
        retryCount: 1,
        terminalFailureCount: 0,
        converged: true,
      },
    });
  });

  it("seeds dashboard-ready normal and over-quota usage states", async () => {
    const runtime = createSaasDemoRuntime();
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
      "llm.cost_usd_nanos",
      "llm.prompt_tokens",
      "storage_gb",
    ]);
    expect(meters.find((meter) => meter.meterId === "api_requests")?.metadata).toMatchObject({
      featureKey: "api.requests",
      unit: "request",
    });
    expect(meters.find((meter) => meter.meterId === "api_requests")).toMatchObject({
      billing: "required",
      aggregation: "COUNT",
      unit: "request",
      quota: 2,
      allowOverQuota: true,
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
    expect(meters.find((meter) => meter.meterId === "llm.cost_usd_nanos")?.metadata).toMatchObject({
      provider: "in-memory",
      unit: "usd_nanos",
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
    const snapshot = await runSaasDemoFlow(createSaasDemoRuntime());

    expect(snapshot.operations).toEqual({
      healthStatus: "up",
      diagnosticsSummary: "all_healthy",
    });
    expect(() => assertSaasDemoSnapshot(snapshot)).not.toThrow();
  });

  it("keeps lifecycle evidence in the demo response contract", async () => {
    const snapshot = await runSaasDemoFlow(createSaasDemoRuntime());
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
    const snapshot = await runSaasDemoFlow(createSaasDemoRuntime());

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
