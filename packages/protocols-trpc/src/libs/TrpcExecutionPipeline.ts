import {
  Container,
  Context,
  DEV_INSPECTOR_TOKEN,
  type Guard,
  type RuntimeInspector,
  type RuntimeInspectorRecorder,
  recordRuntimeInspectionEvent,
} from "@croco/framework-context";
import { Problem, ProblemFactory } from "@croco/problems-core";
import type {
  CallHandler,
  ExceptionFilter,
  ExecutionContext,
  Interceptor,
} from "@croco/protocols-rest";
import { TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server";
import { createTrpcFilterProblem, createTrpcProblemDetails } from "./TrpcProblemError";
import type { TrpcExecutionContext } from "./TrpcExecutionContext";

const TRPC_FILTER_FAILURE_DIAGNOSTIC_CODE = "CROCO_TRPC_FILTER_001";

export type TrpcPipelineConfig = {
  readonly guards: readonly Guard<ExecutionContext>[];
  readonly interceptors: readonly Interceptor<ExecutionContext>[];
  readonly filters: readonly ExceptionFilter<unknown, ExecutionContext>[];
};

/**
 * Runs the controller lifecycle metadata for a tRPC procedure without depending on an HTTP transport.
 */
export class TrpcExecutionPipeline {
  async runGuards(
    context: TrpcExecutionContext,
    guards: readonly Guard<ExecutionContext>[],
  ): Promise<void> {
    for (const guard of guards) {
      if (!(await guard.canActivate(context))) {
        throw ProblemFactory.forbidden("TRPC_ACCESS_DENIED", "Access denied");
      }
    }
  }

  async runInterceptors<T>(
    context: ExecutionContext,
    handler: () => Promise<T>,
    interceptors: readonly Interceptor<ExecutionContext>[],
  ): Promise<T> {
    let next: CallHandler = { handle: handler };

    for (let index = interceptors.length - 1; index >= 0; index--) {
      const interceptor = interceptors[index];
      if (!interceptor) {
        continue;
      }

      const currentNext = next;
      next = {
        handle: () => interceptor.intercept(context, currentNext),
      };
    }

    return (await next.handle()) as T;
  }

  async rethrowFiltered(
    error: unknown,
    context: TrpcExecutionContext,
    filters: readonly ExceptionFilter<unknown, ExecutionContext>[],
  ): Promise<never> {
    const originalError = unwrapTrpcError(error);
    const handledProblem = await this.runFilters(originalError, context, filters);
    const errorToExpose =
      handledProblem ?? (originalError instanceof Problem ? originalError : error);

    throw toTrpcError(errorToExpose);
  }

  private async runFilters(
    error: unknown,
    context: TrpcExecutionContext,
    filters: readonly ExceptionFilter<unknown, ExecutionContext>[],
  ): Promise<Problem | undefined> {
    for (const filter of filters) {
      try {
        const result = await filter.catch(error, context);
        const handledProblem = await toHandledProblem(result);

        if (handledProblem) {
          return handledProblem;
        }
        if (result !== undefined) {
          this.recordFilterFailure(error, filter, "invalid-return");
        }
      } catch (filterError) {
        this.recordFilterFailure(error, filter, "thrown", filterError);
        // Preserve the original failure contract when a filter itself fails.
      }
    }

    return undefined;
  }

  private recordFilterFailure(
    originalError: unknown,
    filter: ExceptionFilter<unknown, ExecutionContext>,
    reason: "invalid-return" | "thrown",
    filterError?: unknown,
  ): void {
    const inspector = this.getRuntimeInspector();
    if (!inspector) {
      return;
    }

    recordRuntimeInspectionEvent(inspector, {
      kind: "diagnostic",
      outcome: "failed",
      name: TRPC_FILTER_FAILURE_DIAGNOSTIC_CODE,
      details: {
        diagnosticCode: TRPC_FILTER_FAILURE_DIAGNOSTIC_CODE,
        filter: getProviderName(filter, "filter"),
        reason,
        originalErrorName: getErrorName(originalError),
        ...(filterError !== undefined ? { filterErrorName: getErrorName(filterError) } : {}),
      },
    });
  }

  private getRuntimeInspector(): RuntimeInspectorRecorder | undefined {
    return (
      Context.get()?.runtimeInspector ??
      Container.getOptional<RuntimeInspector>(DEV_INSPECTOR_TOKEN)
    );
  }
}

function unwrapTrpcError(error: unknown): unknown {
  return error instanceof TRPCError && error.cause !== undefined ? error.cause : error;
}

export function toTrpcError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof Problem) {
    const details = createTrpcProblemDetails(error);

    return new TRPCError({
      code: toTrpcErrorCode(error),
      message: details.detail ?? details.code,
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    cause: error,
  });
}

async function toHandledProblem(result: unknown): Promise<Problem | undefined> {
  if (isHttpFilterResponse(result)) {
    return createTrpcFilterProblem(result.body, result.status);
  }

  if (!(result instanceof Response)) {
    return undefined;
  }

  try {
    const body = await result.clone().json();

    return isRecord(body) ? createTrpcFilterProblem(body, result.status) : undefined;
  } catch {
    return undefined;
  }
}

function isHttpFilterResponse(
  result: unknown,
): result is { readonly status: number; readonly body: Record<string, unknown> } {
  if (!isRecord(result) || typeof result.status !== "number" || !isRecord(result.body)) {
    return false;
  }

  return Number.isInteger(result.status) && result.status >= 400 && result.status <= 599;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getProviderName(provider: unknown, fallback: string): string {
  if (typeof provider !== "object" || provider === null || !("constructor" in provider)) {
    return fallback;
  }

  const constructor = provider.constructor;
  return typeof constructor === "function" && constructor.name ? constructor.name : fallback;
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function toTrpcErrorCode(problem: Problem): TRPC_ERROR_CODE_KEY {
  switch (problem.status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
    case 410:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 413:
      return "PAYLOAD_TOO_LARGE";
    case 422:
      return "UNPROCESSABLE_CONTENT";
    case 429:
      return "TOO_MANY_REQUESTS";
    case 501:
      return "NOT_IMPLEMENTED";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}
