import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsManager } from "../libs/AnalyticsManager";

// Mock implementation of abstract AnalyticsManager for testing
class MockAnalyticsManager extends AnalyticsManager {
  capture = vi.fn();
  identify = vi.fn();
  group = vi.fn();
}

describe("AnalyticsManager", () => {
  let analyticsManager!: MockAnalyticsManager;

  beforeEach(() => {
    analyticsManager = new MockAnalyticsManager();
  });

  describe("capture", () => {
    it("should capture an event with name only", () => {
      analyticsManager.capture("button_clicked");

      expect(analyticsManager.capture).toHaveBeenCalledWith("button_clicked");
    });

    it("should capture an event with properties", () => {
      const properties = { buttonId: "submit-btn", page: "/checkout" };
      analyticsManager.capture("button_clicked", properties);

      expect(analyticsManager.capture).toHaveBeenCalledWith("button_clicked", properties);
    });

    it("should handle empty properties object", () => {
      analyticsManager.capture("page_view", {});

      expect(analyticsManager.capture).toHaveBeenCalledWith("page_view", {});
    });

    it("should handle complex properties with nested objects", () => {
      const properties = {
        product: { id: "prod-123", name: "Widget", price: 29.99 },
        user: { segment: "premium", lifetimeValue: 1500 },
      };
      analyticsManager.capture("product_purchased", properties);

      expect(analyticsManager.capture).toHaveBeenCalledWith("product_purchased", properties);
    });
  });

  describe("identify", () => {
    it("should identify a user with distinctId only", () => {
      analyticsManager.identify("user-123");

      expect(analyticsManager.identify).toHaveBeenCalledWith("user-123");
    });

    it("should identify a user with properties", () => {
      const properties = {
        email: "user@example.com",
        name: "John Doe",
        plan: "premium",
      };
      analyticsManager.identify("user-456", properties);

      expect(analyticsManager.identify).toHaveBeenCalledWith("user-456", properties);
    });

    it("should handle user traits with metadata", () => {
      const properties = {
        email: "admin@example.com",
        role: "administrator",
        permissions: ["read", "write", "delete"],
        createdAt: "2025-01-15T00:00:00Z",
      };
      analyticsManager.identify("user-admin-1", properties);

      expect(analyticsManager.identify).toHaveBeenCalledWith("user-admin-1", properties);
    });
  });

  describe("group", () => {
    it("should associate user with a group using groupType and groupKey", () => {
      analyticsManager.group("company", "acme-corp");

      expect(analyticsManager.group).toHaveBeenCalledWith("company", "acme-corp");
    });

    it("should associate user with group including properties", () => {
      const properties = {
        name: "Acme Corporation",
        industry: "Manufacturing",
        employeeCount: 500,
        plan: "enterprise",
      };
      analyticsManager.group("company", "globex-inc", properties);

      expect(analyticsManager.group).toHaveBeenCalledWith("company", "globex-inc", properties);
    });

    it("should handle different group types", () => {
      analyticsManager.group("organization", "org-123", { name: "OpenAI" });
      analyticsManager.group("tenant", "tenant-abc", { tier: "pro" });
      analyticsManager.group("account", "acct-xyz", { status: "active" });

      expect(analyticsManager.group).toHaveBeenCalledTimes(3);
      expect(analyticsManager.group).toHaveBeenNthCalledWith(1, "organization", "org-123", {
        name: "OpenAI",
      });
      expect(analyticsManager.group).toHaveBeenNthCalledWith(2, "tenant", "tenant-abc", {
        tier: "pro",
      });
      expect(analyticsManager.group).toHaveBeenNthCalledWith(3, "account", "acct-xyz", {
        status: "active",
      });
    });

    it("should handle empty group properties", () => {
      analyticsManager.group("company", "startup-co", {});

      expect(analyticsManager.group).toHaveBeenCalledWith("company", "startup-co", {});
    });
  });

  describe("flush", () => {
    it("should provide a default no-op flush contract", async () => {
      await expect(analyticsManager.flush()).resolves.toBeUndefined();
    });

    it("should allow providers to override flush", async () => {
      class FlushableAnalyticsManager extends AnalyticsManager {
        capture(): void {}
        identify(): void {}
        group(): void {}
        flush = vi.fn().mockResolvedValue(undefined);
      }

      const flushable = new FlushableAnalyticsManager();

      await flushable.flush();

      expect(flushable.flush).toHaveBeenCalledTimes(1);
    });
  });

  describe("token", () => {
    it("should have a static token for DI", () => {
      expect(AnalyticsManager.token.name).toBe("AnalyticsManager");
    });
  });

  describe("contract verification", () => {
    it("should require capture method to be implemented", () => {
      // This test verifies the abstract contract
      expect(analyticsManager.capture).not.toBeUndefined();
      expect(typeof analyticsManager.capture).toBe("function");
    });

    it("should require identify method to be implemented", () => {
      expect(typeof analyticsManager.identify).toBe("function");
    });

    it("should require group method to be implemented", () => {
      expect(typeof analyticsManager.group).toBe("function");
    });

    it("should be extendable by concrete implementations", () => {
      // Verify that a class can extend AnalyticsManager
      class ConcreteAnalyticsManager extends AnalyticsManager {
        capture(): void {}
        identify(): void {}
        group(): void {}
      }

      const concrete = new ConcreteAnalyticsManager();
      expect(concrete).toBeInstanceOf(AnalyticsManager);
    });
  });

  describe("B2B SaaS scenario", () => {
    it("should support typical tenant-based analytics flow", () => {
      // Typical B2B SaaS flow: login -> identify -> group -> track events
      const userId = "user-tenant-admin";
      const tenantId = "tenant-123";

      // Step 1: Identify the user
      analyticsManager.identify(userId, {
        email: "admin@company.com",
        name: "Admin User",
        role: "tenant_admin",
      });

      // Step 2: Associate with tenant group
      analyticsManager.group("tenant", tenantId, {
        name: "Acme Corporation",
        plan: "enterprise",
        seats: 100,
      });

      // Step 3: Track events
      analyticsManager.capture("dashboard_viewed", { feature: "analytics" });
      analyticsManager.capture("report_generated", { reportType: "monthly" });

      expect(analyticsManager.identify).toHaveBeenCalledTimes(1);
      expect(analyticsManager.group).toHaveBeenCalledTimes(1);
      expect(analyticsManager.capture).toHaveBeenCalledTimes(2);
    });
  });
});
