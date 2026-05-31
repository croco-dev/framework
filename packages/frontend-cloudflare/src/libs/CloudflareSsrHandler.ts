import type { CrocoFetchHandler, RenderServer, RuntimeContext } from "@croco/meta-vite";
import type { SsrHandlerOptions, SsrWorkerEnv } from "./types";

/**
 * Creates a Cloudflare Workers SSR handler using meta-vite's RenderServer.
 *
 * @param options.renderServer - The RenderServer instance for page rendering
 * @param options.apiBindingName - Service Binding name for API worker (default: 'API_WORKER')
 */
export function createSsrHandler(
  options: SsrHandlerOptions & { renderServer?: RenderServer } = {},
): (request: Request, env: SsrWorkerEnv, ctx: ExecutionContext) => Promise<Response> {
  const { renderServer, apiBindingName = "API_WORKER" } = options;

  return async (request, env, _ctx): Promise<Response> => {
    const url = new URL(request.url);

    // ASSETS static fallback
    if (env.ASSETS) {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse && assetResponse.status !== 404) {
          return assetResponse;
        }
      } catch {
        // ASSETS fetch 실패 시 렌더링 계속
      }
    }

    // Service Binding API fetch
    const apiWorker = (env as SsrWorkerEnv & Record<string, Fetcher | undefined>)[apiBindingName];

    if (apiWorker && url.pathname.startsWith("/api/")) {
      try {
        const apiResponse = await apiWorker.fetch(request);
        if (apiResponse) {
          return apiResponse;
        }
      } catch {
        return new Response("API request failed", { status: 500 });
      }
    }

    // SSR page rendering via meta-vite RenderServer
    if (renderServer) {
      const ctx: RuntimeContext = {
        platform: "cloudflare",
        env,
        executionContext: _ctx,
      };

      try {
        return await renderServer.handle(request, ctx);
      } catch (error) {
        // frontend-cloudflare has no DI container dependency (it is an edge runtime package).
        // eslint-disable-next-line no-console
        console.error("SSR rendering error:", error);
        return new Response("Internal server error", { status: 500 });
      }
    }

    return new Response("No render server configured", { status: 500 });
  };
}

/**
 * Creates a meta-vite CrocoFetchHandler from SSR options.
 * This is the internal handler used by the Cloudflare Workers exported fetch.
 */
export function createSsrHandlerAsFetchHandler(
  options: SsrHandlerOptions & { renderServer?: RenderServer } = {},
): CrocoFetchHandler {
  const { renderServer, apiBindingName = "API_WORKER" } = options;

  return async (request: Request, context?: RuntimeContext): Promise<Response> => {
    const url = new URL(request.url);
    const env = context?.env as SsrWorkerEnv | undefined;

    // ASSETS static fallback
    if (env?.ASSETS) {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse && assetResponse.status !== 404) {
          return assetResponse;
        }
      } catch {
        // ASSETS fetch 실패 시 렌더링 계속
      }
    }

    // Service Binding API fetch
    const apiWorker = (env as SsrWorkerEnv & Record<string, Fetcher | undefined>)?.[apiBindingName];

    if (apiWorker && url.pathname.startsWith("/api/")) {
      try {
        const apiResponse = await apiWorker.fetch(request);
        if (apiResponse) {
          return apiResponse;
        }
      } catch {
        return new Response("API request failed", { status: 500 });
      }
    }

    // SSR page rendering via meta-vite RenderServer
    if (renderServer) {
      try {
        return await renderServer.handle(request, context);
      } catch (error) {
        // frontend-cloudflare has no DI container dependency (it is an edge runtime package).
        // eslint-disable-next-line no-console
        console.error("SSR rendering error:", error);
        return new Response("Internal server error", { status: 500 });
      }
    }

    return new Response("No render server configured", { status: 500 });
  };
}
