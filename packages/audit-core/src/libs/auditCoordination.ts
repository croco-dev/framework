import { AsyncLocalStorage } from "node:async_hooks";

type AuditCoordinationState = {
  auditWritten: boolean;
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
  const state = { auditWritten: false, propertyKey, target };
  return parent ? { ...state, parent } : state;
}

export function runWithAuditCoordination<T>(state: AuditCoordinationState, callback: () => T): T {
  return auditCoordinationStorage.run(state, callback);
}

export function hasAuditCoordination(target: object, propertyKey: string | symbol): boolean {
  let state = auditCoordinationStorage.getStore();
  while (state) {
    if (state.target === target && state.propertyKey === propertyKey) {
      return true;
    }
    state = state.parent;
  }
  return false;
}

export function markAuditWrite(target: object, propertyKey: string | symbol): void {
  let state = auditCoordinationStorage.getStore();
  while (state) {
    if (state.target === target && state.propertyKey === propertyKey) {
      state.auditWritten = true;
    }
    state = state.parent;
  }
}
