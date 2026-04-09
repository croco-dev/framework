import type { MiddlewareFunction } from '../types';

export type CorsOptions = {
  origins: string[];
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  exposedHeaders?: string[];
};

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const DEFAULT_MAX_AGE = 86400;

/**
 * 허용된 Origin에 대해 CORS 응답 헤더를 설정하는 미들웨어입니다.
 */
export const corsMiddleware = (options: CorsOptions): MiddlewareFunction => {
  const {
    origins,
    methods = DEFAULT_METHODS,
    allowedHeaders,
    credentials = false,
    maxAge = DEFAULT_MAX_AGE,
    exposedHeaders,
  } = options;

  return async (ctx, next): Promise<void> => {
    const requestOrigin = ctx.header('origin');

    if (!requestOrigin || !origins.includes(requestOrigin)) {
      await next();
      return;
    }

    const isPreflight = ctx.req.method === 'OPTIONS';

    ctx.raw.header('Access-Control-Allow-Origin', requestOrigin);
    ctx.raw.header('Access-Control-Allow-Methods', methods.join(', '));

    if (allowedHeaders && allowedHeaders.length > 0) {
      ctx.raw.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    }

    if (exposedHeaders && exposedHeaders.length > 0) {
      ctx.raw.header('Access-Control-Expose-Headers', exposedHeaders.join(', '));
    }

    if (credentials) {
      ctx.raw.header('Access-Control-Allow-Credentials', 'true');
    }

    if (isPreflight) {
      ctx.raw.header('Access-Control-Max-Age', String(maxAge));
      ctx.res.status = 204;
      return;
    }

    await next();
  };
};
