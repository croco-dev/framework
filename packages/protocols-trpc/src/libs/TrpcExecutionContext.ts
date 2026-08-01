import type { Constructor, ExecutionContext } from "@croco/protocols-rest";

/**
 * Adapts a tRPC procedure invocation to Croco's controller execution context.
 */
export class TrpcExecutionContext implements ExecutionContext {
  constructor(
    private readonly trpcContext: unknown,
    private readonly controllerClass: Constructor,
    private readonly handlerName: string | symbol,
    private readonly path: string,
    private readonly method: string,
  ) {}

  getRequest(): Request {
    return readRequest(this.trpcContext);
  }

  getClass(): Constructor {
    return this.controllerClass;
  }

  getHandler(): string | symbol {
    return this.handlerName;
  }

  getPath(): string {
    return this.path;
  }

  getMethod(): string {
    return this.method;
  }

  getTrpcContext(): unknown {
    return this.trpcContext;
  }
}

function readRequest(context: unknown): Request {
  if (isRecord(context)) {
    const request = context.request ?? context.req;

    if (isObject(request)) {
      return request as Request;
    }
  }

  return context as Request;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}
