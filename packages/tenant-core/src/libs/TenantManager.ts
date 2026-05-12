import { Context } from "@croco/framework-context";
import { recordEvent } from "@croco/telemetry-api";
import { TenantRequiredProblem } from "./problems/TenantRequiredProblem";

/**
 * Manages tenant context using AsyncLocalStorage.
 * Provides tenant isolation across async boundaries.
 */
export class TenantManager {
  /**
   * Run a function within a tenant context.
   * The tenant context will be available to all async operations within.
   */
  async run<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    recordEvent("tenant.context.enter", {
      "tenant.id": tenantId,
    });

    return Context.run(
      {
        ...(Context.get() ?? { requestId: "tenant-context" }),
        tenantId,
      },
      fn,
    );
  }

  /**
   * Get the current tenant ID, or null if not in a tenant context.
   */
  getTenantId(): string | null {
    return Context.getTenantId();
  }

  /**
   * Get the current tenant ID, throwing if not in a tenant context.
   * Use this when tenant context is required.
   */
  requireTenantId(): string {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new TenantRequiredProblem("TenantManager.requireTenantId");
    }
    return tenantId;
  }

  /**
   * Check if currently within a tenant context.
   */
  isInTenantContext(): boolean {
    return Context.getTenantId() !== null;
  }

  /**
   * Run a function outside of the current tenant context.
   * Useful for cross-tenant operations or admin tasks.
   */
  async suspend<T>(fn: () => Promise<T>): Promise<T> {
    const currentContext = Context.get();

    if (!currentContext) {
      return fn();
    }

    const { tenantId: _tenantId, ...contextWithoutTenant } = currentContext;

    return Context.run(contextWithoutTenant, fn);
  }
}
