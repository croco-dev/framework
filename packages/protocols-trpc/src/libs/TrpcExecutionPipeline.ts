import {
  Container,
  Context,
  DEV_INSPECTOR_TOKEN,
  type Guard,
  type RuntimeInspector,
  type RuntimeInspectorRecorder,
  recordRuntimeInspectionEvent,
} from "@croco/framework-context";
import { OPERATOR_ONLY_PROBLEM_DETAIL, Problem, ProblemFactory } from "@croco/problems-core";
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
    if (error.code === "INTERNAL_SERVER_ERROR" && !(error.cause instanceof Problem)) {
      return new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: OPERATOR_ONLY_PROBLEM_DETAIL,
        cause: error.cause,
      });
    }

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
    message: OPERATOR_ONLY_PROBLEM_DETAIL,
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

const PROBLEM_STATUS_TO_TRPC_CODE: ReadonlyMap<number, TRPC_ERROR_CODE_KEY> = new Map([
  [400, "BAD_REQUEST"],
  [401, "UNAUTHORIZED"],
  [402, "PAYMENT_REQUIRED"],
  [403, "FORBIDDEN"],
  [404, "NOT_FOUND"],
  [405, "METHOD_NOT_SUPPORTED"],
  [406, "BAD_REQUEST"],
  [407, "UNAUTHORIZED"],
  [408, "TIMEOUT"],
  [409, "CONFLICT"],
  [410, "NOT_FOUND"],
  [411, "BAD_REQUEST"],
  [412, "PRECONDITION_FAILED"],
  [413, "PAYLOAD_TOO_LARGE"],
  [414, "PAYLOAD_TOO_LARGE"],
  [415, "UNSUPPORTED_MEDIA_TYPE"],
  [416, "BAD_REQUEST"],
  [417, "PRECONDITION_FAILED"],
  [418, "BAD_REQUEST"],
  [422, "UNPROCESSABLE_CONTENT"],
  [423, "CONFLICT"],
  [424, "PRECONDITION_FAILED"],
  [425, "PRECONDITION_FAILED"],
  [426, "PRECONDITION_REQUIRED"],
  [428, "PRECONDITION_REQUIRED"],
  [429, "TOO_MANY_REQUESTS"],
  [431, "PAYLOAD_TOO_LARGE"],
  [451, "FORBIDDEN"],
  [500, "INTERNAL_SERVER_ERROR"],
  [501, "NOT_IMPLEMENTED"],
  [502, "BAD_GATEWAY"],
  [503, "SERVICE_UNAVAILABLE"],
  [504, "GATEWAY_TIMEOUT"],
  [505, "INTERNAL_SERVER_ERROR"],
  [506, "INTERNAL_SERVER_ERROR"],
  [507, "INTERNAL_SERVER_ERROR"],
  [508, "INTERNAL_SERVER_ERROR"],
  [510, "INTERNAL_SERVER_ERROR"],
  [511, "INTERNAL_SERVER_ERROR"],
]);

function toTrpcErrorCode(problem: Problem): TRPC_ERROR_CODE_KEY {
  return PROBLEM_STATUS_TO_TRPC_CODE.get(problem.status) ?? "INTERNAL_SERVER_ERROR";
}
