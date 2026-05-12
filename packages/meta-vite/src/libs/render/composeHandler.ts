import type { ApiRouteIR } from '../routes/types';
import type { RenderServer } from './renderServer';
import type { CrocoApiHandlerResult, CrocoFetchHandler, RuntimeContext } from './types';

const NOT_FOUND_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
} as const;

const NOT_FOUND_RESPONSE = new Response('<h1>Not Found</h1>', {
  status: 404,
  headers: NOT_FOUND_HEADERS,
});

const API_NOT_FOUND_RESPONSE = new Response(JSON.stringify({ error: 'Not Found' }), {
  status: 404,
  headers: { 'content-type': 'application/json' },
});

export type MetaFetchHandlerOptions = {
  readonly apiHandler?: (request: Request, context?: RuntimeContext) => Promise<CrocoApiHandlerResult>;
  readonly pageHandler?: RenderServer | CrocoFetchHandler;
  readonly apiRoutes?: readonly ApiRouteIR[];
};

export function createMetaFetchHandler(options: MetaFetchHandlerOptions): CrocoFetchHandler {
  return async (request: Request, context?: RuntimeContext): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // URL-based API route dispatch: /api/* → apiRoutes matching
    if (options.apiRoutes && pathname.startsWith('/api/')) {
      const route = options.apiRoutes.find((r) => {
        const methodMatch = r.method === undefined || r.method === request.method;
        const exactMatch = pathname === r.path;
        const prefixMatch = pathname.startsWith(`${r.path}/`);
        return methodMatch && (exactMatch || prefixMatch);
      });

      if (route) {
        return route.handler(request);
      }

      // API route miss → 404 (NOT page fallback)
      return API_NOT_FOUND_RESPONSE;
    }

    // Legacy apiHandler flow (backward compatibility)
    if (options.apiHandler) {
      let apiResult: CrocoApiHandlerResult;

      try {
        apiResult = await options.apiHandler(request, context);
      } catch {
        apiResult = { handled: false };
      }

      if (apiResult.handled) {
        return apiResult.response;
      }
    }

    if (!options.pageHandler) {
      return NOT_FOUND_RESPONSE;
    }

    const pageHandler = options.pageHandler;

    if (isRenderServer(pageHandler)) {
      return pageHandler.handle(request, context);
    }

    return pageHandler(request, context);
  };
}

function isRenderServer(pageHandler: RenderServer | CrocoFetchHandler): pageHandler is RenderServer {
  return 'handle' in pageHandler && typeof pageHandler.handle === 'function';
}
