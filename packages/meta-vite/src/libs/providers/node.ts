import type { CrocoFetchHandler, RuntimeContext } from '../render/types';

type NodeApiHandler = {
  match: (request: Request) => boolean;
  handle: (request: Request) => Promise<Response>;
};

type NodeComposedOptions = {
  apiHandlers: Array<NodeApiHandler>;
  pageHandler: CrocoFetchHandler;
};

/**
 * Node.js HTTP server adapter.
 * Wraps a CrocoFetchHandler for `@hono/node-server`-compatible `serve({ fetch })`.
 */
export function createNodeHandler(handler: CrocoFetchHandler): { fetch: (request: Request) => Promise<Response> } {
  return {
    fetch: async (request: Request) => {
      const ctx: RuntimeContext = {
        platform: 'node',
      };
      return handler(request, ctx);
    },
  };
}

export function createNodeComposedHandler(options: NodeComposedOptions): {
  fetch: (request: Request) => Promise<Response>;
} {
  return {
    fetch: async (request: Request) => {
      for (const apiHandler of options.apiHandlers) {
        if (apiHandler.match(request)) {
          return apiHandler.handle(request);
        }
      }

      const ctx: RuntimeContext = {
        platform: 'node',
      };
      return options.pageHandler(request, ctx);
    },
  };
}
