import type { ILogger } from "./ILogger";

export type Scope = "singleton" | "request" | "transient";

export type Constructor<T = unknown> = new (...args: never[]) => T;

export type DependencyTokenKind = "constructor" | "typedi-token" | "string" | "symbol";

export type DependencyProviderKind =
  | "component"
  | "registered-value"
  | "lazy"
  | "typedi"
  | "missing";

export type DependencyResolutionStepStatus = "selected" | "missing" | "circular" | "scope-mismatch";

export type DependencyResolutionTraceStatus =
  | "ready"
  | "resolved"
  | "failed"
  | "missing"
  | "circular"
  | "scope-mismatch";

export type DependencyResolutionStep = {
  readonly token: string;
  readonly tokenKind: DependencyTokenKind;
  readonly provider: DependencyProviderKind;
  readonly status: DependencyResolutionStepStatus;
  readonly reason: string;
  readonly path: readonly string[];
  readonly scope?: Scope;
  readonly dependencyOf?: string;
  readonly parameterIndex?: number;
};

export type DependencyResolutionTrace = {
  readonly root: string;
  readonly status: DependencyResolutionTraceStatus;
  readonly steps: readonly DependencyResolutionStep[];
};

export interface ComponentOptions {
  scope?: Scope;
}

export interface ComponentMetadata {
  scope: Scope;
  target: Constructor;
}

export type UserContext = {
  id: string;
  email?: string;
  [key: string]: unknown;
};

export type RuntimePlatform = "node" | "lambda" | "cloudflare-workers" | (string & {});

export type RuntimeTraceContext = {
  traceId?: string;
  spanId?: string;
  traceFlags?: string | number;
};

export type RuntimeCapabilities = {
  env: boolean;
  logger: boolean;
  trace: boolean;
  waitUntil: boolean;
  flush: boolean;
  shutdown: boolean;
};

export type RuntimeNativeContext = Record<string, unknown>;

export type RuntimeInspectorRecorderEventInput = {
  readonly inspectionId?: string;
  readonly requestId?: string;
  readonly kind: string;
  readonly outcome?: "started" | "succeeded" | "failed" | "skipped";
  readonly name?: string;
  readonly durationMs?: number;
  readonly details?: Record<string, unknown>;
};

export interface RuntimeInspectorRecorder {
  recordEvent(input: RuntimeInspectorRecorderEventInput): void;
}

export interface RuntimeContext {
  platform: RuntimePlatform;
  requestId: string;
  env?: Record<string, unknown>;
  logger?: ILogger;
  trace?: RuntimeTraceContext;
  capabilities: RuntimeCapabilities;
  native?: RuntimeNativeContext;
  waitUntil(promise: Promise<unknown>): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface RequestContext {
  requestId: string;
  inspectionId?: string;
  user?: UserContext;
  tenantId?: string;
  traceId?: string;
  spanId?: string;
  traceFlags?: string | number;
  runtime?: RuntimeContext;
  runtimeInspector?: RuntimeInspectorRecorder;
}

export type Middleware<TContext = RequestContext> = (
  ctx: TContext,
  next: () => Promise<void>,
) => Promise<void>;

export interface LifecycleHooks<TContext = RequestContext> {
  onRequestStart?: (ctx: TContext) => Promise<void> | void;

  onRequestEnd?: (ctx: TContext, result?: unknown) => Promise<void> | void;

  onRequestError?: (ctx: TContext, error: Error) => Promise<void> | void;
}

export interface ShutdownHook {
  onShutdown(signal?: AbortSignal): Promise<void>;
}
