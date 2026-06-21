import type { MiddlewareFunction } from "../types";

export type SecurityMiddlewareExportName =
  | "securityHeadersMiddleware"
  | "corsMiddleware"
  | "bodyLimitMiddleware"
  | "rateLimitHttpMiddleware";

const SECURITY_MIDDLEWARE_EXPORT_KEY = "__crocoSecurityMiddlewareExport";

type MarkedSecurityMiddleware = MiddlewareFunction & {
  readonly [SECURITY_MIDDLEWARE_EXPORT_KEY]?: SecurityMiddlewareExportName;
};

export function markSecurityMiddleware(
  middleware: MiddlewareFunction,
  exportName: SecurityMiddlewareExportName,
): MiddlewareFunction {
  Object.defineProperty(middleware, SECURITY_MIDDLEWARE_EXPORT_KEY, {
    configurable: false,
    enumerable: false,
    value: exportName,
    writable: false,
  });

  return middleware;
}

export function isSecurityMiddleware(
  middleware: MiddlewareFunction,
  exportName: SecurityMiddlewareExportName,
): boolean {
  return (middleware as MarkedSecurityMiddleware)[SECURITY_MIDDLEWARE_EXPORT_KEY] === exportName;
}
