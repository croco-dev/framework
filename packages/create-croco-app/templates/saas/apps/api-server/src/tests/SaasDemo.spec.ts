import { Container } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { assertSaasDemoSnapshot, createSaasRuntime, runSaasDemoFlow } from "../saasDemo";

describe("SaaS golden path demo", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("creates tenant and owner membership", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.tenant.slug).toBe("acme");
    expect(snapshot.tenant.status).toBe("trial");
    expect(snapshot.membership.ownerRole).toBe("owner");
  });

  it("creates invitation and member membership", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.invitation.status).toBe("accepted");
    expect(snapshot.invitation.invitedUserId).toBe("user_member");
    expect(snapshot.membership.memberRole).toBe("member");
    expect(snapshot.membership.memberCount).toBe(2);
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
  });

  it("exposes health and diagnostics endpoints", async () => {
    const snapshot = await runSaasDemoFlow(createSaasRuntime());

    expect(snapshot.operations).toEqual({
      healthStatus: "up",
      diagnosticsSummary: "all_healthy",
    });
    expect(() => assertSaasDemoSnapshot(snapshot)).not.toThrow();
  });
});
