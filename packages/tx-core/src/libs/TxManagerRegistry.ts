import { DuplicateTxManagerRegistrationProblem, TxManagerNotRegisteredError } from "./errors";
import type { TxManager } from "./TxManager";
import { DEFAULT_TX_MANAGER_KEY, type TxManagerKey } from "./types";

type TxManagerInstance = TxManager<unknown, unknown>;

/** 애플리케이션이 소유하는 키 기반 트랜잭션 매니저 레지스트리입니다. */
export class TxManagerRegistry {
  private readonly managers = new Map<TxManagerKey, TxManagerInstance>();

  register(manager: TxManagerInstance, key?: TxManagerKey): void {
    const managerKey = key ?? DEFAULT_TX_MANAGER_KEY;

    if (this.managers.has(managerKey)) {
      throw new DuplicateTxManagerRegistrationProblem(key === undefined ? undefined : String(key));
    }

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
