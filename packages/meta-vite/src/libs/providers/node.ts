import { Problem, ProblemCategory } from "@croco/problems-core";
import type { CrocoFetchHandler, RuntimeContext } from "../render/types";

type NodeApiHandler = {
  match: (request: Request) => boolean;
  handle: (request: Request) => Promise<Response>;
};

export type NodeHandlerOptions = {
  /**
   * The public origin this server answers for, such as `https://shop.example`.
   * Node HTTP servers build `request.url` from the client's `Host` header or
   * an absolute request target, so without it a client chooses the authority
   * a server component sees. Requests for another host get 400; accepted
   * requests are rewritten to this origin, so a server behind a proxy that
   * ends TLS still sees its public `https` URL.
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
      const pinned = pinRequestOrigin(request, expectedOrigin);
      if (pinned instanceof Response) {
        return pinned;
      }
      const ctx: RuntimeContext = {
        platform: "node",
      };
      return handler(pinned, ctx);
    },
  };
}

export function createNodeComposedHandler(options: NodeComposedOptions): {
  fetch: (request: Request) => Promise<Response>;
} {
  const expectedOrigin = normalizeOrigin(options.origin);

  return {
    fetch: async (request: Request) => {
      const pinned = pinRequestOrigin(request, expectedOrigin);
      if (pinned instanceof Response) {
        return pinned;
      }
      for (const apiHandler of options.apiHandlers) {
        if (apiHandler.match(pinned)) {
          return apiHandler.handle(pinned);
        }
      }

      const ctx: RuntimeContext = {
        platform: "node",
      };
      return options.pageHandler(pinned, ctx);
    },
  };
}

function normalizeOrigin(origin: string | undefined): URL | undefined {
  return origin === undefined ? undefined : new URL(new URL(origin).origin);
}

// Only the host is compared: the server, not the client, decides the scheme
// (`@hono/node-server` reads it from the socket), so a proxy that ends TLS
// would otherwise make every request look foreign.
function pinRequestOrigin(request: Request, expected: URL | undefined): Request | Response {
  if (expected === undefined) {
    return request;
  }
  const url = new URL(request.url);
  if (url.host !== expected.host) {
    const problem = new NodeRequestOriginProblem(expected.origin, url.host);
    return new Response(JSON.stringify({ error: problem.message, code: problem.code }), {
      status: problem.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  if (url.protocol === expected.protocol) {
    return request;
  }
  return new Request(new URL(`${url.pathname}${url.search}`, expected), request);
}
