import type { MiddlewareFunction } from '../types';

export type CorsOptions = {
  /** Allowed origins (allowlist) */
  origins: string[];
  /** Allowed HTTP methods. Default: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] */
  methods?: string[];
  /** Allowed request headers */
  allowedHeaders?: string[];
  /** Whether to include credentials. Default: false */
  credentials?: boolean;
  /** Preflight cache duration in seconds. Default: 86400 (24 hours) */
  maxAge?: number;
};

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const DEFAULT_MAX_AGE = 86400;

/**
 * CORS (Cross-Origin Resource Sharing) middleware
 *
 * Handles preflight requests automatically and adds CORS headers to responses.
 * Only adds CORS headers if the request origin is in the allowlist.
 *
 * @example
 * ```typescript
 * app.use(corsMiddleware({
 *   origins: ['https://example.com', 'https://app.example.com'],
 *   methods: ['GET', 'POST'],
 *   credentials: true,
 * }));
 * ```
 */
export const corsMiddleware = (options: CorsOptions): MiddlewareFunction => {
  const { origins, methods = DEFAULT_METHODS, allowedHeaders, credentials = false, maxAge = DEFAULT_MAX_AGE } = options;

  return async (ctx, next): Promise<void> => {
    const requestOrigin = ctx.header('origin');

    // Origin이 allowlist에 없으면 CORS 헤더 추가 안 함
    if (!requestOrigin || !origins.includes(requestOrigin)) {
      await next();
      return;
    }

    const isPreflight = ctx.req.method === 'OPTIONS';

    // CORS 헤더 설정
    ctx.raw.header('Access-Control-Allow-Origin', requestOrigin);
    ctx.raw.header('Access-Control-Allow-Methods', methods.join(', '));

    if (allowedHeaders && allowedHeaders.length > 0) {
      ctx.raw.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    }

    if (credentials) {
      ctx.raw.header('Access-Control-Allow-Credentials', 'true');
    }

    // Preflight 요청 처리
    if (isPreflight) {
      ctx.raw.header('Access-Control-Max-Age', String(maxAge));
      ctx.res.status = 204;
      return; // next() 호출 안 함
    }

    await next();
  };
};
