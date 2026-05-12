import type { CrocoFetchHandler, RuntimeContext } from "../render/types";

type CloudflareApiHandler = {
  match: (request: Request) => boolean;
  handle: (request: Request, env: unknown, executionContext: ExecutionContext) => Promise<Response>;
};

type CloudflareComposedOptions = {
  apiHandlers: CloudflareApiHandler[];
  pageHandler: CrocoFetchHandler;
};

declare global {
  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
}

export function createCloudflareHandler(handler: CrocoFetchHandler): ExportedHandlerFetchHandler {
  return async (request: Request, env: unknown, executionContext: ExecutionContext) => {
    const ctx: RuntimeContext = {
      platform: "cloudflare",
      env,
      executionContext,
    };
    return handler(request, ctx);
  };
}

/**
 * Cloudflare adapter with API-first routing and page fallback.
 * InMemory ISR is process-local in Cloudflare Workers and is not durable across isolates or deploys.
 */
export function createCloudflareComposedHandler(
  options: CloudflareComposedOptions,
): ExportedHandlerFetchHandler {
  return async (request: Request, env: unknown, executionContext: ExecutionContext) => {
    for (const apiHandler of options.apiHandlers) {
      if (apiHandler.match(request)) {
        return apiHandler.handle(request, env, executionContext);
      }
    }

    const ctx: RuntimeContext = {
      platform: "cloudflare",
      env,
      executionContext,
    };
    return options.pageHandler(request, ctx);
  };
}

type ExportedHandlerFetchHandler = (
  request: Request,
  env: unknown,
  executionContext: ExecutionContext,
) => Promise<Response>;
