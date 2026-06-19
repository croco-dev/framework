import type {
  ILogger,
  KnownRuntimePlatform,
  RuntimeCapabilities,
  RuntimeCapabilityName,
  RuntimeCapabilityOverridesFor,
  RuntimeCapabilitySupport,
  RuntimeCapabilitySupportForPlatform,
  RuntimeContext,
  RuntimeNativeContext,
  RuntimePlatform,
  RuntimeTraceContext,
} from "@croco/framework-context";
import {
  getRuntimeCapabilitySupport,
  isKnownRuntimePlatform,
  RUNTIME_CAPABILITY_NAMES,
} from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";

const CROCO_RUNTIME_CONTEXT_ENV_KEY: unique symbol = Symbol(
  "@croco/transports-http/runtimeContext",
);

type RuntimeCapabilitySupportInput<TPlatform extends RuntimePlatform> =
  TPlatform extends KnownRuntimePlatform
    ? { capabilitySupport?: never }
    : { capabilitySupport: RuntimeCapabilitySupport };

type RuntimeCapabilityOverridesWithHook<
  TPlatform extends RuntimePlatform,
  TCapability extends RuntimeCapabilityName,
> = Omit<RuntimeCapabilityOverridesFor<TPlatform>, TCapability> & {
  readonly [TKey in TCapability]?: true;
};

type RuntimeCapabilityOverridesWithoutHook<
  TPlatform extends RuntimePlatform,
  TCapability extends RuntimeCapabilityName,
> = Omit<RuntimeCapabilityOverridesFor<TPlatform>, TCapability> & {
  readonly [TKey in TCapability]?: false;
};

type HookBackedRuntimeCapability<
  TPlatform extends RuntimePlatform,
  TCapability extends RuntimeCapabilityName,
  THookName extends string,
  THook,
> = RuntimeCapabilitySupportForPlatform<TPlatform>[TCapability] extends false
  ? { readonly [TKey in THookName]?: never }
  :
      | ({
          readonly [TKey in THookName]: THook;
        } & {
          readonly capabilities?: RuntimeCapabilityOverridesWithHook<TPlatform, TCapability>;
        })
      | ({
          readonly [TKey in THookName]?: never;
        } & {
          readonly capabilities?: RuntimeCapabilityOverridesWithoutHook<TPlatform, TCapability>;
        });

type RuntimeCapabilityHooks<TPlatform extends RuntimePlatform> = HookBackedRuntimeCapability<
  TPlatform,
  "waitUntil",
  "waitUntil",
  (promise: Promise<unknown>) => void
> &
  HookBackedRuntimeCapability<TPlatform, "flush", "flush", () => Promise<void> | void> &
  HookBackedRuntimeCapability<TPlatform, "shutdown", "shutdown", () => Promise<void> | void>;

type RuntimeContextInitForPlatform<TPlatform extends RuntimePlatform> = {
  platform: TPlatform;
  requestId?: string;
  env?: Record<string, unknown>;
  logger?: ILogger;
  trace?: RuntimeTraceContext;
  capabilities?: RuntimeCapabilityOverridesFor<TPlatform>;
  native?: RuntimeNativeContext;
} & RuntimeCapabilitySupportInput<TPlatform> &
  RuntimeCapabilityHooks<TPlatform>;

export type RuntimeContextInit<TPlatform extends RuntimePlatform = RuntimePlatform> =
  TPlatform extends RuntimePlatform ? RuntimeContextInitForPlatform<TPlatform> : never;

export class RuntimeCapabilityProblem extends Problem {
  readonly code = "transports-http/runtime-capability-invalid";
  readonly category = ProblemCategory.Conflict;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}

type RuntimeContextEnvCarrier = {
  [CROCO_RUNTIME_CONTEXT_ENV_KEY]?: RuntimeContextInit;
};

const DEFAULT_CAPABILITIES: RuntimeCapabilities = {
  env: false,
  filesystem: false,
  logger: false,
  nodeApi: false,
  requestLifecycle: false,
  trace: false,
  waitUntil: false,
  flush: false,
  shutdown: false,
};

const IMPLEMENTATION_BACKED_RUNTIME_CAPABILITIES: readonly RuntimeCapabilityName[] = [
  "env",
  "logger",
  "trace",
  "waitUntil",
  "flush",
  "shutdown",
] as const;

export function createRuntimeContext(init: RuntimeContextInit): RuntimeContext {
  const support = getRuntimeCapabilitySupportForInit(init);
  const capabilities: RuntimeCapabilities = {
    ...DEFAULT_CAPABILITIES,
    filesystem: support.filesystem,
    nodeApi: support.nodeApi,
    requestLifecycle: support.requestLifecycle,
    ...init.capabilities,
    env: init.capabilities?.env ?? init.env !== undefined,
    logger: init.capabilities?.logger ?? init.logger !== undefined,
    trace: init.capabilities?.trace ?? init.trace !== undefined,
    waitUntil: init.capabilities?.waitUntil ?? init.waitUntil !== undefined,
    flush: init.capabilities?.flush ?? init.flush !== undefined,
    shutdown: init.capabilities?.shutdown ?? init.shutdown !== undefined,
  };

  assertRuntimeCapabilities(init, capabilities, support);

  return {
    platform: init.platform,
    requestId: init.requestId ?? "",
    env: init.env,
    logger: init.logger,
    trace: init.trace,
    capabilities,
    native: init.native,
    waitUntil: (promise) => runRuntimeWaitUntil(init, promise),
    flush: async () => runRuntimeFlush(init),
    shutdown: async () => runRuntimeShutdown(init),
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

function assertRuntimeCapabilities(
  init: RuntimeContextInit,
  capabilities: RuntimeCapabilities,
  support: RuntimeCapabilities,
): void {
  for (const capability of RUNTIME_CAPABILITY_NAMES) {
    const implemented = hasRuntimeCapabilityImplementation(init, capability);
    const isImplementationBacked = IMPLEMENTATION_BACKED_RUNTIME_CAPABILITIES.includes(capability);

    if (
      !support[capability] &&
      (capabilities[capability] || (isImplementationBacked && implemented))
    ) {
      throw new RuntimeCapabilityProblem(
        `Runtime platform '${init.platform}' does not support capability '${capability}'.`,
      );
    }

    if (isImplementationBacked && capabilities[capability] && !implemented) {
      throw new RuntimeCapabilityProblem(
        `Runtime platform '${init.platform}' declares capability '${capability}' without an implementation.`,
      );
    }
  }
}

function getRuntimeCapabilitySupportForInit(init: RuntimeContextInit): RuntimeCapabilities {
  if (isKnownRuntimePlatform(init.platform)) {
    return getRuntimeCapabilitySupport(init.platform);
  }

  if (init.capabilitySupport) {
    return init.capabilitySupport;
  }

  throw new RuntimeCapabilityProblem(
    `Runtime platform '${init.platform}' requires explicit capability support.`,
  );
}

function hasRuntimeCapabilityImplementation(
  init: RuntimeContextInit,
  capability: RuntimeCapabilityName,
): boolean {
  switch (capability) {
    case "env":
      return init.env !== undefined;
    case "filesystem":
      return true;
    case "logger":
      return init.logger !== undefined;
    case "nodeApi":
      return true;
    case "requestLifecycle":
      return true;
    case "trace":
      return init.trace !== undefined;
    case "waitUntil":
      return init.waitUntil !== undefined;
    case "flush":
      return init.flush !== undefined;
    case "shutdown":
      return init.shutdown !== undefined;
  }
}

function runRuntimeWaitUntil(init: RuntimeContextInit, promise: Promise<unknown>): void {
  if (typeof init.waitUntil === "function") {
    init.waitUntil(promise);
  }
}

async function runRuntimeFlush(init: RuntimeContextInit): Promise<void> {
  if (typeof init.flush === "function") {
    await init.flush();
  }
}

async function runRuntimeShutdown(init: RuntimeContextInit): Promise<void> {
  if (typeof init.shutdown === "function") {
    await init.shutdown();
  }
}

export function getRuntimeContextInitFromEnv(env: unknown): RuntimeContextInit | undefined {
  if (typeof env !== "object" || env === null) {
    return undefined;
  }

  const carrier = env as RuntimeContextEnvCarrier;
  return carrier[CROCO_RUNTIME_CONTEXT_ENV_KEY];
}
