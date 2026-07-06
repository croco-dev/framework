import {
  Container,
  Context,
  DEV_INSPECTOR_TOKEN,
  type Guard,
  type RequestPipelineGraph,
  type RequestPipelineNode,
  type RuntimeInspector,
  type RuntimeInspectorRecorder,
  compileRequestPipelineGraph,
  recordRuntimeInspectionEvent,
} from "@croco/framework-context";
import { Problem, ProblemCategoryMapper, ProblemFactory } from "@croco/problems-core";
import type {
  CallHandler,
  ExceptionFilter,
  ExecutionContext,
  Interceptor,
} from "@croco/protocols-rest";
import type { ErrorHandler } from "./ErrorHandler";
import type { HttpExecutionContext } from "./HttpExecutionContext";
import type { CompiledRoutePipelineGraphConfig, MiddlewareFunction } from "./types";

type FilterResponse = {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

const BODY_SPECIFIC_RESPONSE_HEADERS = new Set([
  "content-length",
  "content-encoding",
  "content-md5",
  "content-digest",
  "digest",
  "repr-digest",
  "etag",
]);

function isFilterResponse(value: unknown): value is FilterResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    "headers" in value &&
    "body" in value &&
    typeof (value as FilterResponse).status === "number"
  );
}

export interface PipelineConfig {
  guards: Guard<ExecutionContext>[];
  interceptors: Interceptor<ExecutionContext>[];
  filters: ExceptionFilter<unknown, HttpExecutionContext>[];
}

export type HttpPipelineGraphConfig = CompiledRoutePipelineGraphConfig & {
  readonly middlewares?: readonly MiddlewareFunction[];
};

export function describeHttpPipelineGraph(config: HttpPipelineGraphConfig): RequestPipelineGraph {
  const middlewares = config.middlewares ?? [];
  const guards = config.guards ?? [];
  const interceptors = config.interceptors ?? [];
  const filters = config.filters ?? [];
  const nodes: RequestPipelineNode[] = [
    ...middlewares.map((middleware, index) =>
      toNode(
        `middleware:${index}:before`,
        "middleware",
        "before",
        10 + index,
        `${getProviderName(middleware, `middleware[${index}]`)}.before`,
        "short-circuit",
      ),
    ),
    ...guards.map((guard, index) =>
      toNode(
        `guard:${index}`,
        "guard",
        "before",
        100 + index,
        getProviderName(guard, `guard[${index}]`),
        "terminal",
      ),
    ),
    ...interceptors.map((interceptor, index) =>
      toNode(
        `interceptor:${index}:before`,
        "interceptor",
        "before",
        300 + index,
        `${getProviderName(interceptor, `interceptor[${index}]`)}.before`,
        "observe-and-rethrow",
      ),
    ),
    toNode(
      config.handlerId ?? "handler",
      "handler",
      "handler",
      10,
      config.handlerLabel ?? "handler",
      "terminal",
    ),
    ...interceptors.map((interceptor, index) =>
      toNode(
        `interceptor:${index}:after`,
        "interceptor",
        "after",
        100 + interceptors.length - index,
        `${getProviderName(interceptor, `interceptor[${index}]`)}.after`,
        "observe-and-rethrow",
      ),
    ),
    ...middlewares.map((middleware, index) =>
      toNode(
        `middleware:${index}:after`,
        "middleware",
        "after",
        200 + middlewares.length - index,
        `${getProviderName(middleware, `middleware[${index}]`)}.after`,
        "short-circuit",
      ),
    ),
    ...filters.map((filter, index) =>
      toNode(
        `filter:${index}`,
        "filter",
        "error",
        10 + index,
        getProviderName(filter, `filter[${index}]`),
        "handle-error",
      ),
    ),
  ];

  return compileRequestPipelineGraph(nodes, {
    ...(config.target !== undefined ? { target: config.target } : {}),
    ...(config.policyPlan !== undefined ? { policyPlan: config.policyPlan } : {}),
  });
}

/**
 * Guard, Interceptor, Filter 체인을 조합해 컨트롤러 핸들러를 실행합니다.
 */
export class PipelineRunner {
  constructor(private readonly errorHandler: ErrorHandler) {}

  async run(
    execContext: HttpExecutionContext,
    handler: () => Promise<unknown>,
    config: PipelineConfig,
  ): Promise<unknown> {
    try {
      await this.runGuards(execContext, config.guards);

      return await this.runInterceptorChain(execContext, handler, config.interceptors);
    } catch (error) {
      this.recordPipelineError(error);
      return await this.runFilters(error, execContext, config.filters);
    }
  }

  private async runGuards(
    context: ExecutionContext,
    guards: Guard<ExecutionContext>[],
  ): Promise<void> {
    for (const guard of guards) {
      const canActivate = await guard.canActivate(context);
      if (!canActivate) {
        throw ProblemFactory.forbidden("ACCESS_DENIED", "Access denied");
      }
    }
  }

  private async runInterceptorChain(
    context: ExecutionContext,
    handler: () => Promise<unknown>,
    interceptors: Interceptor<ExecutionContext>[],
  ): Promise<unknown> {
    if (interceptors.length === 0) {
      return handler();
    }

    let next: CallHandler = { handle: handler };

    for (let i = interceptors.length - 1; i >= 0; i--) {
      const interceptor = interceptors[i];
      if (interceptor === undefined) {
        continue;
      }

      const currentNext = next;
      next = {
        handle: () => interceptor.intercept(context, currentNext),
      };
    }

    return next.handle();
  }

  private async runFilters(
    error: unknown,
    context: HttpExecutionContext,
    filters: ExceptionFilter<unknown, HttpExecutionContext>[],
  ): Promise<unknown> {
    const nextError = error;

    for (const filter of filters) {
      try {
        const result = await filter.catch(nextError, context);
        // Redact Problem Details from filter-owned HTTP shapes before returning them.
        if (result instanceof Response) {
          return await this.createRedactedFilterResponse(nextError, context, result);
        }
        if (isFilterResponse(result)) {
          const httpCtx = context.getHttpContext();
          const body = this.errorHandler.createFilterResponseBody(nextError, result.body, httpCtx);
          if (body === result.body && hasProblemJsonContentType(result.headers)) {
            const fallbackResponse = this.errorHandler.handleError(nextError, httpCtx);
            copyFilterResponseHeaders(fallbackResponse, Object.entries(result.headers));
            return fallbackResponse;
          }

          const response = httpCtx.jsonResponse(body, result.status);
          // Apply custom headers from the filter (e.g. Content-Type: application/problem+json)
          copyFilterResponseHeaders(response, Object.entries(result.headers));
          return response;
        }
        return result;
      } catch (filterError) {
        this.recordPipelineError(filterError);
      }
    }

    return this.errorHandler.handleError(nextError, context.getHttpContext());
  }

  private async createRedactedFilterResponse(
    error: unknown,
    context: HttpExecutionContext,
    response: Response,
  ): Promise<Response> {
    const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/problem+json")) {
      return response;
    }

    const httpCtx = context.getHttpContext();
    const createFallbackResponse = () => {
      const fallbackResponse = this.errorHandler.handleError(error, httpCtx);
      copyFilterResponseHeaders(fallbackResponse, response.headers.entries());
      return fallbackResponse;
    };

    let parsedBody: unknown;
    try {
      parsedBody = await response.clone().json();
    } catch {
      return createFallbackResponse();
    }

    if (!isRecord(parsedBody)) {
      return createFallbackResponse();
    }

    const body = this.errorHandler.createFilterResponseBody(error, parsedBody, httpCtx);
    if (body === parsedBody) {
      return createFallbackResponse();
    }

    const redactedResponse = httpCtx.jsonResponse(body, response.status);
    copyFilterResponseHeaders(redactedResponse, response.headers.entries());

    return redactedResponse;
  }

  private recordPipelineError(error: unknown): void {
    const inspector: RuntimeInspectorRecorder | undefined =
      Context.get()?.runtimeInspector ??
      Container.getOptional<RuntimeInspector>(DEV_INSPECTOR_TOKEN);
    if (!inspector) {
      return;
    }

    if (error instanceof Problem) {
      recordRuntimeInspectionEvent(inspector, {
        kind: "problem",
        outcome: "failed",
        name: error.code,
        details: {
          code: error.code,
          category: error.category,
          status: ProblemCategoryMapper.toHttpStatus(error.category),
          title: error.title,
          detail: error.detail,
        },
      });
      return;
    }

    const normalizedError = error instanceof Error ? error : new Error(String(error));
    recordRuntimeInspectionEvent(inspector, {
      kind: "error",
      outcome: "failed",
      name: normalizedError.name,
      details: {
        name: normalizedError.name,
        message: normalizedError.message,
      },
    });
  }
}

function toNode(
  id: string,
  kind: RequestPipelineNode["kind"],
  phase: RequestPipelineNode["phase"],
  order: number,
  label: string,
  failurePropagation: RequestPipelineNode["failurePropagation"],
): RequestPipelineNode {
  return {
    id,
    kind,
    phase,
    order,
    label,
    ...(failurePropagation !== undefined ? { failurePropagation } : {}),
  };
}

function getProviderName(provider: unknown, fallback: string): string {
  if (typeof provider === "function" && provider.name.length > 0) {
    return provider.name;
  }

  if (typeof provider !== "object" || provider === null) {
    return fallback;
  }

  const constructorName = provider.constructor.name;
  if (constructorName.length > 0 && constructorName !== "Object") {
    return constructorName;
  }

  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasProblemJsonContentType(headers: Record<string, string>): boolean {
  return (
    Object.entries(headers)
      .find(([key]) => key.toLowerCase() === "content-type")?.[1]
      .toLowerCase()
      .includes("application/problem+json") ?? false
  );
}

function copyFilterResponseHeaders(response: Response, headers: Iterable<[string, string]>): void {
  for (const [key, value] of headers) {
    if (!BODY_SPECIFIC_RESPONSE_HEADERS.has(key.toLowerCase())) {
      response.headers.set(key, value);
    }
  }
}
