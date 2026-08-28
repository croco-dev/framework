import { AsyncLocalStorage } from "node:async_hooks";

type AuditCoordinationState = {
  decoratorWritesAudit: boolean;
  parent?: AuditCoordinationState;
  propertyKey: string | symbol;
  target: object;
};

const auditCoordinationStorage = new AsyncLocalStorage<AuditCoordinationState>();

export function createAuditCoordinationState(
  target: object,
  propertyKey: string | symbol,
): AuditCoordinationState {
  const parent = auditCoordinationStorage.getStore();
  const state = { decoratorWritesAudit: false, propertyKey, target };
  return parent ? { ...state, parent } : state;
}

export function runWithAuditCoordination<T>(state: AuditCoordinationState, callback: () => T): T {
  return auditCoordinationStorage.run(state, callback);
}

export function markDecoratorAuditWrite(target: object, propertyKey: string | symbol): void {
  let state = auditCoordinationStorage.getStore();
  while (state) {
    if (state.target === target && state.propertyKey === propertyKey) {
      state.decoratorWritesAudit = true;
    }
    state = state.parent;
  }
}
