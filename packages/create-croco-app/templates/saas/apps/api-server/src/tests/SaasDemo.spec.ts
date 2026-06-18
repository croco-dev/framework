import { Container } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { JobsController } from "../controllers/JobsController";
import { assertDemoEndpointsEnabled } from "../controllers/SaasController";
import { DemoEndpointDisabledProblem } from "../problems";
import {
  getSaasProviderProfile,
  isSaasDemoEndpointEnabled,
  SAAS_DEMO_ENDPOINTS_ENABLED_ENV,
} from "../providerProfiles";
import {
  assertSaasDemoSnapshot,
  createSaasRuntime,
  defaultSaasRuntime,
  runSaasDemoFlow,
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

    expect(meters.map((meter) => meter.meterId).sort()).toEqual(["api_requests", "storage_gb"]);
    expect(meters.find((meter) => meter.meterId === "api_requests")?.metadata).toMatchObject({
      featureKey: "api.requests",
      unit: "request",
    });
    expect(meters.find((meter) => meter.meterId === "storage_gb")?.metadata).toMatchObject({
      featureKey: "storage.gb",
      unit: "GB",
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
    const seeded = await runSaasDemoFlow(defaultSaasRuntime);
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
