import { Problem, ProblemCategory } from "@croco/problems-core";
import type { CrocoFetchHandler, RuntimeContext } from "../render/types";

type NodeApiHandler = {
  match: (request: Request) => boolean;
  handle: (request: Request) => Promise<Response>;
};

export type NodeHandlerOptions = {
  /**
   * The only origin this server answers for, such as `https://shop.example`.
   * Node HTTP servers build `request.url` from the client's `Host` header or
   * an absolute request target, so without it a client chooses the origin a
   * server component sees. Requests for any other origin get 400.
   */
  readonly origin?: string;
};

type NodeComposedOptions = NodeHandlerOptions & {
  apiHandlers: Array<NodeApiHandler>;
  pageHandler: CrocoFetchHandler;
};

export class NodeRequestOriginProblem extends Problem {
  readonly code = "meta-vite/node-request-origin-mismatch";
  readonly category = ProblemCategory.BadRequest;

  constructor(expected: string, received: string) {
    super(
      "meta-vite/node-request-origin-mismatch",
      ProblemCategory.BadRequest,
      `This server answers only for origin '${expected}'`,
      { extensions: { expected, received } },
    );
  }
}

/**
 * Node.js HTTP server adapter.
 * Wraps a CrocoFetchHandler for `@hono/node-server`-compatible `serve({ fetch })`.
 */
export function createNodeHandler(
  handler: CrocoFetchHandler,
  options: NodeHandlerOptions = {},
): {
  fetch: (request: Request) => Promise<Response>;
} {
  const expectedOrigin = normalizeOrigin(options.origin);

  return {
    fetch: async (request: Request) => {
      const refused = refuseForeignOrigin(request, expectedOrigin);
      if (refused) {
        return refused;
      }
      const ctx: RuntimeContext = {
        platform: "node",
      };
      return handler(request, ctx);
    },
  };
}

export function createNodeComposedHandler(options: NodeComposedOptions): {
  fetch: (request: Request) => Promise<Response>;
} {
  const expectedOrigin = normalizeOrigin(options.origin);

  return {
    fetch: async (request: Request) => {
      const refused = refuseForeignOrigin(request, expectedOrigin);
      if (refused) {
        return refused;
      }
      for (const apiHandler of options.apiHandlers) {
        if (apiHandler.match(request)) {
          return apiHandler.handle(request);
        }
      }

      const ctx: RuntimeContext = {
        platform: "node",
      };
      return options.pageHandler(request, ctx);
    },
  };
}

function normalizeOrigin(origin: string | undefined): string | undefined {
  return origin === undefined ? undefined : new URL(origin).origin;
}

function refuseForeignOrigin(
  request: Request,
  expectedOrigin: string | undefined,
): Response | null {
  if (expectedOrigin === undefined) {
    return null;
  }
  const received = new URL(request.url).origin;
  if (received === expectedOrigin) {
    return null;
  }

  const problem = new NodeRequestOriginProblem(expectedOrigin, received);
  return new Response(JSON.stringify({ error: problem.message, code: problem.code }), {
    status: problem.status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
