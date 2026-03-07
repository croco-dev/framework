import { TRANSACTION_CONTEXT_TOKEN } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { TxManagerNotRegisteredError } from './errors';
import type { TxManager } from './TxManager';
import { DEFAULT_TX_MANAGER_KEY, type TxManagerKey } from './types';

type TxManagerInstance = TxManager<unknown, unknown>;

class TxManagerRegistryClass {
  private readonly managers = new Map<TxManagerKey, TxManagerInstance>();

  register(manager: TxManagerInstance, key?: TxManagerKey): void {
    const managerKey = key ?? DEFAULT_TX_MANAGER_KEY;
    this.managers.set(managerKey, manager);

    if (managerKey === DEFAULT_TX_MANAGER_KEY) {
      Container.set(TRANSACTION_CONTEXT_TOKEN as never, manager as never);
    }
  }

  get<TClient = unknown, TOptions = unknown>(key?: TxManagerKey): TxManager<TClient, TOptions> {
    const managerKey = key ?? DEFAULT_TX_MANAGER_KEY;
    const manager = this.managers.get(managerKey);

    if (!manager) {
      throw new TxManagerNotRegisteredError(String(managerKey));
    }

    return manager as TxManager<TClient, TOptions>;
  }

  has(key?: TxManagerKey): boolean {
    const managerKey = key ?? DEFAULT_TX_MANAGER_KEY;
    return this.managers.has(managerKey);
  }

  clear(): void {
    this.managers.clear();
    Container.remove(TRANSACTION_CONTEXT_TOKEN as never);
  }
}

export const TxManagerRegistry = new TxManagerRegistryClass();
