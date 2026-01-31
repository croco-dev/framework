import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContext } from './types';

/**
 * Manages tenant context using AsyncLocalStorage.
 * Provides tenant isolation across async boundaries.
 */
export class TenantManager {
  private readonly als = new AsyncLocalStorage<TenantContext>();

  /**
   * Run a function within a tenant context.
   * The tenant context will be available to all async operations within.
   */
  async run<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    const context: TenantContext = { tenantId };
    return this.als.run(context, fn);
  }

  /**
   * Get the current tenant ID, or null if not in a tenant context.
   */
  getTenantId(): string | null {
    const context = this.als.getStore();
    return context?.tenantId ?? null;
  }

  /**
   * Get the current tenant ID, throwing if not in a tenant context.
   * Use this when tenant context is required.
   */
  requireTenantId(): string {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required but not found');
    }
    return tenantId;
  }

  /**
   * Check if currently within a tenant context.
   */
  isInTenantContext(): boolean {
    return this.als.getStore() !== undefined;
  }

  /**
   * Run a function outside of the current tenant context.
   * Useful for cross-tenant operations or admin tasks.
   */
  async suspend<T>(fn: () => Promise<T>): Promise<T> {
    return this.als.run(undefined as unknown as TenantContext, fn);
  }
}
