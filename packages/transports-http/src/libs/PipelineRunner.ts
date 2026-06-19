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
    target: config.target,
    policyPlan: config.policyPlan,
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
      return this.runFilters(error, execContext, config.filters);
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
      const currentNext = next;
      next = {
        handle: () => interceptor.intercept(context, currentNext),
      };
    }

    return next.handle();
  }

  private runFilters(
    error: unknown,
    context: HttpExecutionContext,
    filters: ExceptionFilter<unknown, HttpExecutionContext>[],
  ): unknown {
    const nextError = error;

    for (const filter of filters) {
      try {
        const result = filter.catch(nextError, context);
        // If the filter returned a proper Response, use it directly.
        // Otherwise convert the plain object { status, headers, body } into a Response.
        if (result instanceof Response) {
          return result;
        }
        if (isFilterResponse(result)) {
          const httpCtx = context.getHttpContext();
          const response = httpCtx.jsonResponse(result.body, result.status);
          // Apply custom headers from the filter (e.g. Content-Type: application/problem+json)
          for (const [key, value] of Object.entries(result.headers)) {
            response.headers.set(key, value);
          }
          return response;
        }
        return result;
      } catch {
        // Filter 실패 시 무시하고 다음 필터로 넘어감
      }
    }

    return this.errorHandler.handleError(nextError, context.getHttpContext());
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
    failurePropagation,
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
