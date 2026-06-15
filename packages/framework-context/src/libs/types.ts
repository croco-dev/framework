import type { ILogger } from "./ILogger";

export type Scope = "singleton" | "request" | "transient";

export type Constructor<T = unknown> = new (...args: never[]) => T;

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
  user?: UserContext;
  tenantId?: string;
  traceId?: string;
  spanId?: string;
  traceFlags?: string | number;
  runtime?: RuntimeContext;
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
