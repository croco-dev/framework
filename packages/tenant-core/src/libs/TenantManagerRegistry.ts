import { TenantManagerNotRegisteredProblem } from './problems/TenantManagerNotRegisteredProblem';
import type { TenantManager } from './TenantManager';

/**
 * Global registry for TenantManager instances.
 * Supports multiple managers with key-based lookup.
 */
export class TenantManagerRegistry {
  private static readonly DEFAULT_KEY = Symbol.for('default');
  private static instance: TenantManagerRegistry;

  private readonly managers: Map<string | symbol, TenantManager>;

  constructor(entries?: Iterable<readonly [string | symbol, TenantManager]>) {
    this.managers = new Map(entries);
  }

  static getInstance(): TenantManagerRegistry {
    if (!TenantManagerRegistry.instance) {
      TenantManagerRegistry.instance = new TenantManagerRegistry();
    }

    return TenantManagerRegistry.instance;
  }

  /**
   * Register a TenantManager instance.
   */
  static register(manager: TenantManager, key?: string | symbol): void {
    TenantManagerRegistry.getInstance().register(manager, key);
  }

  register(manager: TenantManager, key?: string | symbol): void {
    this.managers.set(key ?? TenantManagerRegistry.DEFAULT_KEY, manager);
  }

  /**
   * Get a registered TenantManager instance.
   * @throws Error if manager is not registered
   */
  static get(key?: string | symbol): TenantManager {
    return TenantManagerRegistry.getInstance().get(key);
  }

  get(key?: string | symbol): TenantManager {
    const manager = this.managers.get(key ?? TenantManagerRegistry.DEFAULT_KEY);
    if (!manager) {
      throw new TenantManagerNotRegisteredProblem(key === undefined ? undefined : String(key));
    }
    return manager;
  }

  /**
   * Check if a TenantManager is registered.
   */
  static has(key?: string | symbol): boolean {
    return TenantManagerRegistry.getInstance().has(key);
  }

  has(key?: string | symbol): boolean {
    return this.managers.has(key ?? TenantManagerRegistry.DEFAULT_KEY);
  }

  /**
   * Clear all registered managers. Useful for testing.
   */
  static clear(): void {
    TenantManagerRegistry.getInstance().clear();
  }

  clear(): void {
    this.managers.clear();
  }
}
