import { TxManagerNotRegisteredError } from './errors';
import { TxManager } from './TxManager';
import { TxManagerKey, DEFAULT_TX_MANAGER_KEY } from './types';

type TxManagerInstance = TxManager<unknown, unknown>;

class TxManagerRegistryClass {
  private readonly managers = new Map<TxManagerKey, TxManagerInstance>();

  register(manager: TxManagerInstance, key?: TxManagerKey): void {
    const managerKey = key ?? DEFAULT_TX_MANAGER_KEY;
    this.managers.set(managerKey, manager);
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
  }
}

export const TxManagerRegistry = new TxManagerRegistryClass();
