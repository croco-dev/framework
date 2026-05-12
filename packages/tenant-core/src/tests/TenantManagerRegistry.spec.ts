import { beforeEach, describe, expect, it } from "vitest";
import { DuplicateTenantManagerRegistrationProblem } from "../libs/problems/DuplicateTenantManagerRegistrationProblem";
import { TenantManagerNotRegisteredProblem } from "../libs/problems/TenantManagerNotRegisteredProblem";
import { TenantManager } from "../libs/TenantManager";
import { TenantManagerRegistry } from "../libs/TenantManagerRegistry";

describe("TenantManagerRegistry", () => {
  beforeEach(() => {
    TenantManagerRegistry.clear();
  });

  it("should support isolated registry instances", () => {
    const registry = new TenantManagerRegistry();
    const manager = new TenantManager();

    registry.register(manager);

    expect(registry.get()).toBe(manager);
    expect(TenantManagerRegistry.has()).toBe(false);
  });

  it("should keep static API working through the singleton instance", () => {
    const manager = new TenantManager();

    TenantManagerRegistry.register(manager);

    expect(TenantManagerRegistry.get()).toBe(manager);
    expect(TenantManagerRegistry.has()).toBe(true);
  });

  it("should support keyed registrations on isolated registries", () => {
    const registry = new TenantManagerRegistry();
    const manager = new TenantManager();

    registry.register(manager, "custom");

    expect(registry.get("custom")).toBe(manager);
    expect(registry.has("custom")).toBe(true);
  });

  it("should fail fast when the default manager is registered twice", () => {
    const registry = new TenantManagerRegistry();
    const firstManager = new TenantManager();
    const secondManager = new TenantManager();

    registry.register(firstManager);

    expect(() => registry.register(secondManager)).toThrow(
      DuplicateTenantManagerRegistrationProblem,
    );
    expect(registry.get()).toBe(firstManager);
  });

  it("should fail fast when the same key is registered twice", () => {
    const registry = new TenantManagerRegistry();
    const firstManager = new TenantManager();
    const secondManager = new TenantManager();

    registry.register(firstManager, "custom");

    expect(() => registry.register(secondManager, "custom")).toThrow(
      DuplicateTenantManagerRegistrationProblem,
    );
    expect(registry.get("custom")).toBe(firstManager);
  });

  it("should throw when an isolated registry has no manager", () => {
    const registry = new TenantManagerRegistry();

    expect(() => registry.get()).toThrow(TenantManagerNotRegisteredProblem);
  });

  it("should clear isolated registry instances independently", () => {
    const singletonManager = new TenantManager();
    const isolatedManager = new TenantManager();
    const registry = new TenantManagerRegistry();

    TenantManagerRegistry.register(singletonManager);
    registry.register(isolatedManager);

    registry.clear();

    expect(registry.has()).toBe(false);
    expect(TenantManagerRegistry.get()).toBe(singletonManager);
  });
});
