import type { ILogger } from "@croco/framework-context";
import type { Hono } from "hono";
import { type RuntimeContextInit, withRuntimeContextEnv } from "./runtimeContext";
import type { LambdaContext, LambdaEvent, LambdaHandler } from "./types";

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
};

type LambdaResponseHeaders = {
  headers: Record<string, string>;
  cookies: string[];
};

function isBinaryContentType(contentType: string): boolean {
  const mimeType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";

  if (mimeType === "") {
    return false;
  }

  if (mimeType.startsWith("text/")) {
    return false;
  }

  if (
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("javascript") ||
    mimeType === "application/x-www-form-urlencoded"
  ) {
    return false;
  }

  return true;
}

function getSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as HeadersWithSetCookie).getSetCookie;
  if (typeof getSetCookie === "function") {
    const cookies = getSetCookie.call(headers);
    if (cookies.length > 0) {
      return cookies;
    }
  }

  const cookies: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      cookies.push(value);
    }
  });

  return cookies;
}

function toLambdaResponseHeaders(headers: Headers): LambdaResponseHeaders {
  const responseHeaders: Record<string, string> = {};
  const cookies = getSetCookieHeaders(headers);

  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }

    responseHeaders[key] = value;
  });

  return { headers: responseHeaders, cookies };
}

export interface LambdaExecutionEnv {
  event: LambdaEvent;
  lambdaContext: LambdaContext;
}

export type LambdaExecutionContext = {
  readonly env?: Partial<LambdaExecutionEnv>;
};

export type TypedLambdaHandler = (
  event: LambdaEvent,
  context: LambdaContext,
) => Promise<{
  statusCode: number;
  headers?: Record<string, string>;
  cookies?: string[];
  body?: string;
  isBase64Encoded?: boolean;
}>;

export type LambdaHandlerOptions = {
  logger?: ILogger;
  flush?: () => Promise<void> | void;
};

const WAIT_UNTIL_REJECTION_MESSAGE = "Lambda waitUntil task rejected";
const LAMBDA_FLUSH_BOUNDARY_ERROR_CODE = "transports-http/lambda-flush-boundary-failed";

class LambdaFlushBoundaryError extends Error {
  readonly code = LAMBDA_FLUSH_BOUNDARY_ERROR_CODE;
  readonly originalError: unknown;
  readonly flushErrors: readonly unknown[];

  constructor({
    originalError,
    flushErrors,
  }: {
    originalError: unknown;
    flushErrors: readonly unknown[];
  }) {
    super(
      originalError === undefined
        ? "Lambda handler flush callbacks failed"
        : "Lambda handler failed before flush callbacks completed",
    );
    this.name = "LambdaFlushBoundaryError";
    this.originalError = originalError;
    this.flushErrors = [...flushErrors];
  }
}

function reportWaitUntilRejections(
  results: PromiseSettledResult<unknown>[],
  logger: ILogger | undefined,
): void {
  results.forEach((result, taskIndex) => {
    if (result.status !== "rejected") {
      return;
    }

    if (logger) {
      logger.error(WAIT_UNTIL_REJECTION_MESSAGE, { taskIndex, reason: result.reason });
      return;
    }

    console.error(WAIT_UNTIL_REJECTION_MESSAGE, result.reason);
  });
}

async function collectLambdaFlushErrors(
  runtimeContext: RuntimeContextInit,
  options: LambdaHandlerOptions,
): Promise<unknown[]> {
  const errors: unknown[] = [];

  try {
    await runtimeContext.flush?.();
  } catch (error) {
    errors.push(error);
  }

  try {
    await options.flush?.();
  } catch (error) {
    errors.push(error);
  }

  return errors;
}

async function runWithLambdaFlushBoundary<T>(
  execute: () => Promise<T> | T,
  runtimeContext: RuntimeContextInit,
  options: LambdaHandlerOptions,
): Promise<T> {
  let hasOriginalError = false;
  let originalError: unknown;
  let result: T | undefined;
  let flushErrors: unknown[] = [];

  try {
    result = await execute();
  } catch (error) {
    hasOriginalError = true;
    originalError = error;
  } finally {
    flushErrors = await collectLambdaFlushErrors(runtimeContext, options);
  }

  if (flushErrors.length > 0) {
    if (!hasOriginalError && flushErrors.length === 1) {
      throw flushErrors[0];
    }

    throw new LambdaFlushBoundaryError({
      originalError: hasOriginalError ? originalError : undefined,
      flushErrors,
    });
  }

  if (hasOriginalError) {
    throw originalError;
  }

  return result as T;
}

/**
 * Hono 앱을 API Gateway v2 형태의 AWS Lambda 핸들러로 연결하는 어댑터입니다.
 */
export class CrocoLambdaAdapter {
  constructor(private readonly hono: Hono) {}

  createHandler(options: LambdaHandlerOptions = {}): LambdaHandler {
    return async (event: LambdaEvent, lambdaContext: LambdaContext) => {
      const method = event.requestContext?.http?.method ?? "GET";
      const path = event.rawPath ?? "/";
      const queryString = event.rawQueryString ?? "";
      const url = `https://lambda.local${path}${queryString ? `?${queryString}` : ""}`;

      const headers = new Headers();
      if (event.headers) {
        for (const [key, value] of Object.entries(event.headers)) {
          if (value !== undefined && value !== null) {
            headers.set(key, value);
          }
        }
      }
      if (!headers.has("cookie") && event.cookies && event.cookies.length > 0) {
        headers.set("cookie", event.cookies.join("; "));
      }

      let body: BodyInit | null = null;
      if (event.body) {
        body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body;
      }

      const request = new Request(url, {
        method,
        headers,
        body: ["GET", "HEAD"].includes(method) ? null : body,
      });

      const pendingTasks: Promise<unknown>[] = [];
      const runtimeContext: RuntimeContextInit = {
        platform: "lambda",
        requestId: event.requestContext?.requestId ?? lambdaContext.awsRequestId,
        env: process.env,
        ...(options.logger !== undefined ? { logger: options.logger } : {}),
        native: {
          event,
          lambdaContext,
        },
        waitUntil: (promise) => {
          pendingTasks.push(Promise.resolve(promise));
        },
        flush: async () => {
          const results = await Promise.allSettled(pendingTasks.splice(0));
          reportWaitUntilRejections(results, options.logger);
        },
        capabilities: {
          env: true,
          filesystem: true,
          nodeApi: true,
          requestLifecycle: true,
          waitUntil: true,
          flush: true,
          streamingResponse: false,
          deadline: true,
          abortSignal: false,
          shutdown: false,
        },
      };

      const executionEnv = withRuntimeContextEnv(
        {
          event,
          lambdaContext,
        },
        runtimeContext,
      ) as LambdaExecutionEnv & Record<string, unknown>;

      const response = await runWithLambdaFlushBoundary(
        () => this.hono.fetch(request, executionEnv),
        runtimeContext,
        options,
      );

      const contentType = response.headers.get("content-type") ?? "";
      const isBinary = isBinaryContentType(contentType);
      const responseBody = isBinary
        ? Buffer.from(await response.arrayBuffer()).toString("base64")
        : await response.text();
      const { headers: responseHeaders, cookies } = toLambdaResponseHeaders(response.headers);

      return {
        statusCode: response.status,
        headers: responseHeaders,
        ...(cookies.length > 0 ? { cookies } : {}),
        body: responseBody,
        isBase64Encoded: isBinary,
      };
    };
  }

  getExecutionEnv(c: { env: LambdaExecutionEnv }): LambdaExecutionEnv {
    return c.env;
  }
}

/**
 * Hono 컨텍스트에서 원본 Lambda 이벤트를 추출합니다.
 */
export function getLambdaEvent(honoContext: LambdaExecutionContext): LambdaEvent | undefined {
  return honoContext.env?.event;
}

/**
 * Hono 컨텍스트에서 원본 Lambda 컨텍스트를 추출합니다.
 */
export function getLambdaContext(honoContext: LambdaExecutionContext): LambdaContext | undefined {
  return honoContext.env?.lambdaContext;
}
