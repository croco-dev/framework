import type { ILogger } from "@croco/framework-context";
import type { Hono } from "hono";
import { type RuntimeContextInit, withRuntimeContextEnv } from "./runtimeContext";
import type { LambdaContext, LambdaEvent, LambdaHandler } from "./types";

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
  body?: string;
  isBase64Encoded?: boolean;
}>;

export type LambdaHandlerOptions = {
  logger?: ILogger;
  flush?: () => Promise<void> | void;
};

const WAIT_UNTIL_REJECTION_MESSAGE = "Lambda waitUntil task rejected";

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
        logger: options.logger,
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

      const response = await this.hono.fetch(request, executionEnv);
      await runtimeContext.flush?.();
      await options.flush?.();

      const contentType = response.headers.get("content-type") ?? "";
      const isBinary = isBinaryContentType(contentType);
      const responseBody = isBinary
        ? Buffer.from(await response.arrayBuffer()).toString("base64")
        : await response.text();
      const responseHeaders: Record<string, string> = {};

      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        statusCode: response.status,
        headers: responseHeaders,
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
