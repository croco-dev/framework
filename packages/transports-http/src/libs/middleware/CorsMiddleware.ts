import type { MiddlewareFunction } from "../types";
import { shortCircuit } from "./MiddlewareShortCircuit";
import { markSecurityMiddleware } from "./SecurityMiddlewareMarker";
import { mergeVaryHeader, setVaryHeader } from "./VaryHeader";

export type CorsOptions = {
  origins: string[];
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  exposedHeaders?: string[];
};

const DEFAULT_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
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

  const middleware: MiddlewareFunction = async (ctx, next) => {
    setOriginVary(ctx);
    let varyRequestHeaders = false;
    try {
      const requestOrigin = ctx.header("origin");

      if (!requestOrigin || !origins.includes(requestOrigin)) {
        await next();
        return;
      }

      const isPreflight = ctx.req.method === "OPTIONS";

      ctx.raw.header("Access-Control-Allow-Origin", requestOrigin);
      ctx.raw.header("Access-Control-Allow-Methods", methods.join(", "));

      if (allowedHeaders && allowedHeaders.length > 0) {
        ctx.raw.header("Access-Control-Allow-Headers", allowedHeaders.join(", "));
      } else if (allowedHeaders === undefined && isPreflight) {
        const requestedHeaders = ctx.header("access-control-request-headers");
        if (requestedHeaders) {
          varyRequestHeaders = true;
          ctx.raw.header("Access-Control-Allow-Headers", requestedHeaders);
        }
      }

      if (exposedHeaders && exposedHeaders.length > 0) {
        ctx.raw.header("Access-Control-Expose-Headers", exposedHeaders.join(", "));
      }

      if (credentials) {
        ctx.raw.header("Access-Control-Allow-Credentials", "true");
      }

      if (isPreflight) {
        ctx.raw.header("Access-Control-Max-Age", String(maxAge));
        ctx.res.status = 204;
        return shortCircuit("cors-preflight");
      }

      await next();
    } finally {
      setOriginVary(ctx, varyRequestHeaders);
    }
  };

  return markSecurityMiddleware(middleware, "corsMiddleware");
};

function setOriginVary(ctx: Parameters<MiddlewareFunction>[0], varyRequestHeaders = false): void {
  const headers = ctx.raw.res.headers;
  mergeVaryHeader(headers, ctx.res.headers["vary"] ?? "");
  setVaryHeader(headers, "Origin");
  if (varyRequestHeaders) {
    setVaryHeader(headers, "Access-Control-Request-Headers");
  }
  const vary = headers.get("Vary") ?? "Origin";
  ctx.raw.header("Vary", vary);
  ctx.res.headers["vary"] = vary;
}
