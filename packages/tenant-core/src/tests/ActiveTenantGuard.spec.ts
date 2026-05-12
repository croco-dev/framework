import { describe, expect, it } from "vitest";
import { ActiveTenantGuard } from "../libs/guards/TenantGuard";
import type { Tenant } from "../libs/TenantStore";

describe("ActiveTenantGuard", () => {
  const createMockTenant = (status: string): Tenant => ({
    id: "1",
    slug: "test",
    name: "Test",
    status: status as Tenant["status"],
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("should allow active tenant", () => {
    const guard = new ActiveTenantGuard();
    const tenant = createMockTenant("active");
    expect(guard.canAccess(tenant)).toBe(true);
  });

  it("should allow trial tenant", () => {
    const guard = new ActiveTenantGuard();
    const tenant = createMockTenant("trial");
    expect(guard.canAccess(tenant)).toBe(true);
  });

  it("should deny inactive tenant", () => {
    const guard = new ActiveTenantGuard();
    const tenant = createMockTenant("inactive");
    expect(guard.canAccess(tenant)).toBe(false);
  });

  it("should deny suspended tenant", () => {
    const guard = new ActiveTenantGuard();
    const tenant = createMockTenant("suspended");
    expect(guard.canAccess(tenant)).toBe(false);
  });

  it("should deny expired tenant", () => {
    const guard = new ActiveTenantGuard();
    const tenant = createMockTenant("expired");
    expect(guard.canAccess(tenant)).toBe(false);
  });

  it("should support custom allowed statuses", () => {
    const guard = new ActiveTenantGuard({ allowedStatuses: ["active"] });
    const activeTenant = createMockTenant("active");
    const trialTenant = createMockTenant("trial");

    expect(guard.canAccess(activeTenant)).toBe(true);
    expect(guard.canAccess(trialTenant)).toBe(false);
  });

  it("should return correct name", () => {
    const guard = new ActiveTenantGuard();
    expect(guard.getName()).toBe("ActiveTenantGuard");
  });
});
