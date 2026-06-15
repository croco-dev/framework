import type {
  ILogger,
  RuntimeCapabilities,
  RuntimeContext,
  RuntimeNativeContext,
  RuntimePlatform,
  RuntimeTraceContext,
} from "@croco/framework-context";

const CROCO_RUNTIME_CONTEXT_ENV_KEY: unique symbol = Symbol(
  "@croco/transports-http/runtimeContext",
);

export type RuntimeContextInit = {
  platform: RuntimePlatform;
  requestId?: string;
  env?: Record<string, unknown>;
  logger?: ILogger;
  trace?: RuntimeTraceContext;
  capabilities?: Partial<RuntimeCapabilities>;
  native?: RuntimeNativeContext;
  waitUntil?: (promise: Promise<unknown>) => void;
  flush?: () => Promise<void> | void;
  shutdown?: () => Promise<void> | void;
};

type RuntimeContextEnvCarrier = {
  [CROCO_RUNTIME_CONTEXT_ENV_KEY]?: RuntimeContextInit;
};

const DEFAULT_CAPABILITIES: RuntimeCapabilities = {
  env: false,
  logger: false,
  trace: false,
  waitUntil: false,
  flush: false,
  shutdown: false,
};

export function createRuntimeContext(init: RuntimeContextInit): RuntimeContext {
  const capabilities: RuntimeCapabilities = {
    ...DEFAULT_CAPABILITIES,
    ...init.capabilities,
    env: init.capabilities?.env ?? init.env !== undefined,
    logger: init.capabilities?.logger ?? init.logger !== undefined,
    trace: init.capabilities?.trace ?? init.trace !== undefined,
    waitUntil: init.capabilities?.waitUntil ?? init.waitUntil !== undefined,
    flush: init.capabilities?.flush ?? init.flush !== undefined,
    shutdown: init.capabilities?.shutdown ?? init.shutdown !== undefined,
  };

  return {
    platform: init.platform,
    requestId: init.requestId ?? "",
    env: init.env,
    logger: init.logger,
    trace: init.trace,
    capabilities,
    native: init.native,
    waitUntil: init.waitUntil ?? (() => undefined),
    flush: async () => {
      await init.flush?.();
    },
    shutdown: async () => {
      await init.shutdown?.();
    },
  };
}

export function withRuntimeContextEnv(
  env: Record<string, unknown> | undefined,
  runtimeContext: RuntimeContextInit,
): Record<string, unknown> {
  return {
    ...env,
    [CROCO_RUNTIME_CONTEXT_ENV_KEY]: runtimeContext,
  };
}

export function getRuntimeContextInitFromEnv(env: unknown): RuntimeContextInit | undefined {
  if (typeof env !== "object" || env === null) {
    return undefined;
  }

  const carrier = env as RuntimeContextEnvCarrier;
  return carrier[CROCO_RUNTIME_CONTEXT_ENV_KEY];
}
