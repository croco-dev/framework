import {
  HttpBodyLimitConfigurationProblem,
  HttpRequestBodyReadProblem,
  HttpRequestBodyTooLargeProblem,
  HttpRequestBodyUnavailableProblem,
} from "../problems/HttpRequestBodyProblems";
import type { MiddlewareFunction } from "../types";
import { markSecurityMiddleware } from "./SecurityMiddlewareMarker";

export type BodyLimitOptions = {
  limit?: number;
  statusCode?: number;
  message?: string;
};

const DEFAULT_LIMIT = 1024 * 1024;
const DEFAULT_STATUS = 413;
const DEFAULT_MESSAGE = "Request body too large";

const DECIMAL_CONTENT_LENGTH = /^\d+$/;

type BodyLimitConfig = {
  readonly limit: number;
  readonly statusCode: number;
  readonly message: string;
};

type BoundedBytes = Uint8Array<ArrayBuffer>;

function parseContentLength(value: string | undefined): number | undefined {
  if (!value || !DECIMAL_CONTENT_LENGTH.test(value)) {
    return undefined;
  }

  const length = Number(value);
  return Number.isSafeInteger(length) ? length : undefined;
}

function suppressCancellation(promise: Promise<void>): void {
  void promise.catch(() => undefined);
}

function validateLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new HttpBodyLimitConfigurationProblem();
  }
}

function createTooLargeProblem(
  config: BodyLimitConfig,
  instance: string,
): HttpRequestBodyTooLargeProblem {
  return new HttpRequestBodyTooLargeProblem({
    limit: config.limit,
    status: config.statusCode,
    detail: config.message,
    instance,
  });
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error("Unknown request body read failure");
}

function concatenateChunks(chunks: readonly Uint8Array[], length: number): BoundedBytes {
  const body = new Uint8Array(new ArrayBuffer(length));
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}

async function readBoundedBody(
  request: Request,
  config: BodyLimitConfig,
): Promise<BoundedBytes | undefined> {
  const { body } = request;
  const instance = request.url;

  if (request.bodyUsed || body?.locked) {
    throw new HttpRequestBodyUnavailableProblem(instance);
  }

  const declaredLength = parseContentLength(request.headers.get("content-length") ?? undefined);
  if (declaredLength !== undefined && declaredLength > config.limit) {
    if (body) {
      suppressCancellation(body.cancel());
    }
    throw createTooLargeProblem(config, instance);
  }

  if (!body) {
    return undefined;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;

  try {
    while (true) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch (cause) {
        throw new HttpRequestBodyReadProblem(instance, request.signal.aborted, asError(cause));
      }

      if (result.done) {
        return concatenateChunks(chunks, length);
      }

      if (length + result.value.byteLength > config.limit) {
        suppressCancellation(reader.cancel());
        throw createTooLargeProblem(config, instance);
      }

      chunks.push(result.value);
      length += result.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

function createReplayRequest(request: Request, body: BoundedBytes): Request {
  const replay = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
    cache: request.cache,
    credentials: request.credentials,
    integrity: request.integrity,
    keepalive: request.keepalive,
    ...(request.mode === "navigate" ? {} : { mode: request.mode }),
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    signal: request.signal,
  });
  const cloudflareDescriptor = Object.getOwnPropertyDescriptor(request, "cf");

  if (cloudflareDescriptor && !Object.prototype.hasOwnProperty.call(replay, "cf")) {
    Object.defineProperty(replay, "cf", cloudflareDescriptor);
  }

  return replay;
}

/**
 * 실제 요청 본문 바이트를 기준으로 크기를 제한하는 미들웨어입니다.
 */
export const bodyLimitMiddleware = (options: BodyLimitOptions = {}): MiddlewareFunction => {
  const { limit = DEFAULT_LIMIT, statusCode = DEFAULT_STATUS, message = DEFAULT_MESSAGE } = options;
  validateLimit(limit);
  const config = { limit, statusCode, message };

  const middleware: MiddlewareFunction = async (ctx, next): Promise<void> => {
    const boundedBody = await readBoundedBody(ctx.raw.req.raw, config);

    if (boundedBody !== undefined) {
      try {
        ctx.raw.req.raw = createReplayRequest(ctx.raw.req.raw, boundedBody);
        ctx.raw.req.bodyCache = {};
      } catch (cause) {
        throw new HttpRequestBodyReadProblem(
          ctx.req.url,
          ctx.raw.req.raw.signal.aborted,
          asError(cause),
        );
      }
    }

    await next();
  };

  return markSecurityMiddleware(middleware, "bodyLimitMiddleware");
};

/**
 * 메가바이트 값을 바이트로 변환합니다.
 */
export const mb = (value: number): number => value * 1024 * 1024;

/**
 * 킬로바이트 값을 바이트로 변환합니다.
 */
export const kb = (value: number): number => value * 1024;
