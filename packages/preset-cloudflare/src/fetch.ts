export type CloudflareFetchEnv = {
  readonly [key: string]: unknown;
};

export type ExecutionContext = {
  readonly waitUntil: (promise: Promise<unknown>) => void;
  readonly passThroughOnException: () => void;
};

export type CloudflareFetchHandler = (
  request: Request,
  env: CloudflareFetchEnv,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

export type CloudflareRuntimeContext = {
  readonly platform: "cloudflare-workers";
  readonly requestId?: string;
  readonly env: Record<string, unknown>;
  readonly native: {
    readonly executionContext: ExecutionContext;
  };
  readonly waitUntil: (promise: Promise<unknown>) => void;
  readonly capabilities: {
    readonly env: true;
    readonly filesystem: false;
    readonly nodeApi: false;
    readonly requestLifecycle: true;
    readonly waitUntil: true;
    readonly flush: false;
    readonly streamingResponse: true;
    readonly deadline: false;
    readonly abortSignal: true;
    readonly shutdown: false;
  };
};

export type CloudflareAppFetch = (
  request: Request,
  runtimeContext?: CloudflareRuntimeContext,
  options?: {
    readonly env?: CloudflareFetchEnv;
    readonly executionContext?: ExecutionContext;
  },
) => Response | Promise<Response>;

export type RawHonoFetch = (
  request: Request,
  env: CloudflareFetchEnv,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

export type WorkerFetchHandlerOptions = {
  readonly mode?: "runtime" | "raw-hono";
};

export function createWorkerFetchHandler(
  honoApp: {
    readonly fetch: CloudflareAppFetch | RawHonoFetch;
  },
  options: WorkerFetchHandlerOptions = {},
): CloudflareFetchHandler {
  if (options.mode === "raw-hono") {
    return createRawHonoWorkerFetchHandler(honoApp as { readonly fetch: RawHonoFetch });
  }

  return async (
    request: Request,
    env: CloudflareFetchEnv,
    ctx: ExecutionContext,
  ): Promise<Response> => {
    const runtimeContext = createRuntimeContext(request, env, ctx);
    const fetch = honoApp.fetch as CloudflareAppFetch;

    return fetch(request, runtimeContext, { env, executionContext: ctx });
  };
}

export function createRawHonoWorkerFetchHandler(honoApp: {
  readonly fetch: RawHonoFetch;
}): CloudflareFetchHandler {
  return async (
    request: Request,
    env: CloudflareFetchEnv,
    ctx: ExecutionContext,
  ): Promise<Response> => {
    return honoApp.fetch(request, env, ctx);
  };
}

function createRuntimeContext(
  request: Request,
  env: CloudflareFetchEnv,
  ctx: ExecutionContext,
): CloudflareRuntimeContext {
  return {
    platform: "cloudflare-workers",
    requestId: request.headers.get("x-request-id") ?? undefined,
    env: env as Record<string, unknown>,
    native: {
      executionContext: ctx,
    },
    waitUntil: (promise) => ctx.waitUntil(promise),
    capabilities: {
      env: true,
      filesystem: false,
      nodeApi: false,
      requestLifecycle: true,
      waitUntil: true,
      flush: false,
      streamingResponse: true,
      deadline: false,
      abortSignal: true,
      shutdown: false,
    },
  };
}
