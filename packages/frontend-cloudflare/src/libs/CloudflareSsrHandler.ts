import type { CrocoFetchHandler, RenderServer, RuntimeContext } from "@croco/meta-vite";
import type { SsrHandlerOptions, SsrWorkerEnv } from "./types";

type CloudflareSsrHandlerOptions = SsrHandlerOptions & { renderServer?: RenderServer };

const DEFAULT_API_BINDING_NAME = "API_WORKER";

/**
 * Creates a Cloudflare Workers SSR handler using meta-vite's RenderServer.
 *
 * @param options.renderServer - The RenderServer instance for page rendering
 * @param options.apiBindingName - Service Binding name for API worker (default: 'API_WORKER')
 */
export function createSsrHandler(
  options: CloudflareSsrHandlerOptions = {},
): (request: Request, env: SsrWorkerEnv, ctx: ExecutionContext) => Promise<Response> {
  return async (request, env, executionContext): Promise<Response> => {
    return handleSsrRequest(request, options, {
      env,
      runtimeContext: {
        platform: "cloudflare",
        env,
        executionContext,
      },
    });
  };
}

/**
 * Creates a meta-vite CrocoFetchHandler from SSR options.
 * This is the internal handler used by the Cloudflare Workers exported fetch.
 */
export function createSsrHandlerAsFetchHandler(
  options: CloudflareSsrHandlerOptions = {},
): CrocoFetchHandler {
  return async (request: Request, context?: RuntimeContext): Promise<Response> => {
    return handleSsrRequest(request, options, {
      env: context?.env as SsrWorkerEnv | undefined,
      runtimeContext: context,
    });
  };
}

async function handleSsrRequest(
  request: Request,
  options: CloudflareSsrHandlerOptions,
  context: { readonly env?: SsrWorkerEnv; readonly runtimeContext?: RuntimeContext },
): Promise<Response> {
  const { renderServer, apiBindingName = DEFAULT_API_BINDING_NAME } = options;
  const url = new URL(request.url);
  const { env } = context;

  if (env?.ASSETS) {
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    } catch (error) {
      warnBoundaryFailure("ASSETS binding", error);
    }
  }

  const apiWorker = getFetcherBinding(env, apiBindingName);

  if (apiWorker && url.pathname.startsWith("/api/")) {
    try {
      return await apiWorker.fetch(request);
    } catch {
      return new Response("API request failed", { status: 500 });
    }
  }

  if (renderServer) {
    try {
      return await renderServer.handle(request, context.runtimeContext);
    } catch (error) {
      // frontend-cloudflare has no DI container dependency (it is an edge runtime package).
      // eslint-disable-next-line no-console
      console.error("SSR rendering error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }

  return new Response("No render server configured", { status: 500 });
}

function getFetcherBinding(
  env: SsrWorkerEnv | undefined,
  bindingName: string,
): Fetcher | undefined {
  const binding = env?.[bindingName];

  if (isFetcher(binding)) {
    return binding;
  }

  return undefined;
}

function isFetcher(value: unknown): value is Fetcher {
  return (
    typeof value === "object" &&
    value !== null &&
    "fetch" in value &&
    typeof (value as { readonly fetch?: unknown }).fetch === "function"
  );
}

function warnBoundaryFailure(boundary: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  // frontend-cloudflare has no DI container dependency (it is an edge runtime package).
  // eslint-disable-next-line no-console
  console.warn(
    `@croco/frontend-cloudflare ${boundary} failed; continuing to API or SSR fallback.`,
    message,
  );
}
