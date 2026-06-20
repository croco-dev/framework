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

export type DependencySourceLocation = {
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
};

export type DependencyGraphManifestVersion = "croco.di-graph.manifest.v1";

export type DependencyGraphManifestStatus = "ready" | "failed";

export type DependencyGraphDiagnosticCode =
  | "framework-context/di-missing-provider"
  | "framework-context/di-circular-dependency"
  | "framework-context/di-scope-mismatch"
  | "framework-context/di-unknown-provider";

export type DependencyGraphDiagnostic = {
  readonly code: DependencyGraphDiagnosticCode;
  readonly severity: "error";
  readonly token: string;
  readonly status: Exclude<DependencyResolutionTraceStatus, "ready" | "resolved">;
  readonly message: string;
  readonly path: readonly string[];
  readonly trace: DependencyResolutionTrace;
  readonly sourceLocation?: DependencySourceLocation;
};

export type DependencyGraphProvider = {
  readonly token: string;
  readonly tokenKind: DependencyTokenKind;
  readonly provider: DependencyProviderKind;
  readonly status: DependencyResolutionStepStatus;
  readonly dependencies: readonly string[];
  readonly scope?: Scope;
  readonly sourceLocation?: DependencySourceLocation;
};

export type DependencyGraphManifest = {
  readonly version: DependencyGraphManifestVersion;
  readonly status: DependencyGraphManifestStatus;
  readonly roots: readonly string[];
  readonly providers: readonly DependencyGraphProvider[];
  readonly diagnostics: readonly DependencyGraphDiagnostic[];
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

export type KnownRuntimePlatform = "node" | "lambda" | "cloudflare-workers";

export type RuntimePlatform = KnownRuntimePlatform | (string & {});

export type RuntimeTraceContext = {
  traceId?: string;
  spanId?: string;
  traceFlags?: string | number;
};

export type RuntimeCapabilities = {
  env: boolean;
  filesystem: boolean;
  logger: boolean;
  nodeApi: boolean;
  requestLifecycle: boolean;
  trace: boolean;
  waitUntil: boolean;
  flush: boolean;
  shutdown: boolean;
};

export type RuntimeCapabilityName = keyof RuntimeCapabilities;

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
