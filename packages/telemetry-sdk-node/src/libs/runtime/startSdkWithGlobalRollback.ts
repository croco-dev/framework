import { context, propagation } from "@opentelemetry/api";

type Cleanup = () => void | Promise<void>;

// NodeSDK.start() selects and synchronously registers its own context manager and environment propagator.
// Observe the public setters only during that call, without copying SDK defaults or reading private API globals.
export function startSdkWithGlobalRollback(start: () => void, rollback: Cleanup[]): void {
  const restoreSetters: Array<() => void> = [];
  const restoreProbes: Array<() => void> = [];
  const setContextManager = context.setGlobalContextManager;
  const setPropagator = propagation.setGlobalPropagator;

  try {
    restoreSetters.push(
      replaceMethod(context, "setGlobalContextManager", (manager) => {
        let observed = false;
        let registered = false;
        let disabled = false;
        const active = manager.active;
        const restore = replaceMethod(manager, "active", function () {
          observed = true;
          return active.call(manager);
        });
        restoreProbes.push(restore);
        const cleanup = () => {
          try {
            if (disabled) return;
            if (registered) {
              observed = false;
              context.active();
            }
            if (registered && observed) context.disable();
            else manager.disable();
            disabled = true;
          } finally {
            restore();
          }
        };
        rollback.push(cleanup);
        registered = setContextManager.call(context, manager);
        // SDK defaults are enabled before registration, including when an external owner rejects them.
        if (!registered) cleanup();
        return registered;
      }),
    );
    restoreSetters.push(
      replaceMethod(propagation, "setGlobalPropagator", (propagator) => {
        let observed = false;
        let registered = false;
        const fields = propagator.fields;
        const restore = replaceMethod(propagator, "fields", () => {
          observed = true;
          return fields.call(propagator);
        });
        restoreProbes.push(restore);
        rollback.push(() => {
          try {
            if (registered) {
              observed = false;
              propagation.fields();
              if (observed) propagation.disable();
            }
          } finally {
            restore();
          }
        });
        registered = setPropagator.call(propagation, propagator);
        if (!registered) restore();
        return registered;
      }),
    );
    start();
    // Successful startup keeps SDK ownership and restores all observed objects unchanged.
    for (const restore of restoreProbes) restore();
  } finally {
    for (const restore of restoreSetters.reverse()) restore();
  }
}

function replaceMethod<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K],
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  };
}
