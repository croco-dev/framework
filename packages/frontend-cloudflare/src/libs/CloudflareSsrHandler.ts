import type { SsrHandlerOptions, SsrWorkerEnv } from './types';

export function createSsrHandler(
  options: SsrHandlerOptions = {}
): (request: Request, env: SsrWorkerEnv, ctx: ExecutionContext) => Promise<Response> {
  const apiBindingName = options.apiBindingName ?? 'API_WORKER';

  return async (request, env, _ctx) => {
    const url = new URL(request.url);

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

    const apiWorker = (env as SsrWorkerEnv & Record<string, Fetcher | undefined>)[apiBindingName];

    if (apiWorker && url.pathname.startsWith('/api/')) {
      try {
        const apiResponse = await apiWorker.fetch(request);
        if (apiResponse) {
          return apiResponse;
        }
      } catch {
        return new Response('API request failed', { status: 500 });
      }
    }

    try {
      const { renderPage } = await import('vike/server');

      const pageContext = await renderPage({
        urlOriginal: request.url,
        headersOriginal: request.headers,
      });

      const httpResponse = pageContext.httpResponse;

      if (!httpResponse) {
        return new Response('Page not found', { status: 404 });
      }

      const { readable, writable } = new TransformStream();
      httpResponse.pipe(writable);

      return new Response(readable, {
        status: httpResponse.statusCode,
        headers: httpResponse.headers,
      });
    } catch (error) {
      console.error('SSR rendering error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  };
}
