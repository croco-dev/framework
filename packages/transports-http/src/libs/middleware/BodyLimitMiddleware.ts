import type { MiddlewareFunction } from '../types';

export type BodyLimitOptions = {
  limit?: number;
  statusCode?: number;
  message?: string;
};

const DEFAULT_LIMIT = 1024 * 1024;
const DEFAULT_STATUS = 413;
const DEFAULT_MESSAGE = 'Request body too large';

/**
 * Content-Length 기준으로 요청 본문 크기를 제한하는 미들웨어입니다.
 */
export const bodyLimitMiddleware = (options: BodyLimitOptions = {}): MiddlewareFunction => {
  const { limit = DEFAULT_LIMIT, statusCode = DEFAULT_STATUS, message = DEFAULT_MESSAGE } = options;

  return async (ctx, next): Promise<void> => {
    const contentLength = ctx.header('content-length');

    if (contentLength) {
      const size = parseInt(contentLength, 10);

      if (!Number.isNaN(size) && size > limit) {
        ctx.res.status = statusCode;
        ctx.raw.header('Content-Type', 'application/json');
        throw ctx.jsonResponse(
          {
            error: message,
            limit,
            received: size,
          },
          statusCode
        );
      }
    }

    await next();
  };
};

/**
 * 메가바이트 값을 바이트로 변환합니다.
 */
export const mb = (value: number): number => value * 1024 * 1024;

/**
 * 킬로바이트 값을 바이트로 변환합니다.
 */
export const kb = (value: number): number => value * 1024;
