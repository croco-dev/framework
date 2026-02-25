import { TenantManagerNotRegisteredProblem } from './problems/TenantManagerNotRegisteredProblem';
import type { TenantManager } from './TenantManager';

/**
 * Global registry for TenantManager instances.
 * Supports multiple managers with key-based lookup.
 */
export class TenantManagerRegistry {
  private static managers = new Map<string | symbol, TenantManager>();
  private static readonly DEFAULT_KEY = Symbol.for('default');

  /**
   * Register a TenantManager instance.
   */
  static register(manager: TenantManager, key?: string | symbol): void {
    TenantManagerRegistry.managers.set(key ?? TenantManagerRegistry.DEFAULT_KEY, manager);
  }

  /**
   * Get a registered TenantManager instance.
   * @throws Error if manager is not registered
   */
  static get(key?: string | symbol): TenantManager {
    const manager = TenantManagerRegistry.managers.get(key ?? TenantManagerRegistry.DEFAULT_KEY);
    if (!manager) {
      throw new TenantManagerNotRegisteredProblem(key === undefined ? undefined : String(key));
    }
    return manager;
  }

  /**
   * Check if a TenantManager is registered.
   */
  static has(key?: string | symbol): boolean {
    return TenantManagerRegistry.managers.has(key ?? TenantManagerRegistry.DEFAULT_KEY);
  }

  /**
   * Clear all registered managers. Useful for testing.
   */
  static clear(): void {
    TenantManagerRegistry.managers.clear();
  }
}
