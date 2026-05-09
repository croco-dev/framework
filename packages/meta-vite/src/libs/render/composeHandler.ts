import type { RenderServer } from './renderServer';
import type { CrocoApiHandlerResult, CrocoFetchHandler, RuntimeContext } from './types';

const NOT_FOUND_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
} as const;

export type MetaFetchHandlerOptions = {
  readonly apiHandler?: (request: Request, context?: RuntimeContext) => Promise<CrocoApiHandlerResult>;
  readonly pageHandler?: RenderServer | CrocoFetchHandler;
};

export function createMetaFetchHandler(options: MetaFetchHandlerOptions): CrocoFetchHandler {
  return async (request: Request, context?: RuntimeContext): Promise<Response> => {
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
      return new Response('<h1>Not Found</h1>', {
        status: 404,
        headers: NOT_FOUND_HEADERS,
      });
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
