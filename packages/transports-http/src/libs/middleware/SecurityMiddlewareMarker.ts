import { ProblemFactory } from "@croco/problems-core";
import type { MiddlewareFunction } from "../types";

/**
 * Security capability literals recognized by HTTP bootstrap validation.
 */
export type SecurityMiddlewareCapability =
  | "security-headers"
  | "cors"
  | "body-limit"
  | "rate-limit";

export type SecurityMiddlewareExportName =
  | "securityHeadersMiddleware"
  | "corsMiddleware"
  | "bodyLimitMiddleware"
  | "rateLimitHttpMiddleware";

const SECURITY_MIDDLEWARE_CAPABILITIES: readonly SecurityMiddlewareCapability[] = [
  "security-headers",
  "cors",
  "body-limit",
  "rate-limit",
] as const;

const SECURITY_MIDDLEWARE_CAPABILITY_SET = new Set<string>(SECURITY_MIDDLEWARE_CAPABILITIES);
const SECURITY_MIDDLEWARE_EXPORT_CAPABILITIES = {
  securityHeadersMiddleware: "security-headers",
  corsMiddleware: "cors",
  bodyLimitMiddleware: "body-limit",
  rateLimitHttpMiddleware: "rate-limit",
} as const satisfies Record<SecurityMiddlewareExportName, SecurityMiddlewareCapability>;

const SECURITY_MIDDLEWARE_EXPORT_KEY = "__crocoSecurityMiddlewareExport";
const SECURITY_MIDDLEWARE_CAPABILITIES_KEY = "__crocoSecurityMiddlewareCapabilities";

type SecurityMiddlewareMetadata = {
  readonly capabilities: Set<SecurityMiddlewareCapability>;
};

type MarkedSecurityMiddleware = MiddlewareFunction & {
  readonly [SECURITY_MIDDLEWARE_EXPORT_KEY]?: SecurityMiddlewareExportName;
  readonly [SECURITY_MIDDLEWARE_CAPABILITIES_KEY]?: SecurityMiddlewareMetadata;
};

/**
 * Declares the security capability provided by a custom or wrapped HTTP middleware.
 */
export function declareSecurityMiddlewareCapabilities(
  middleware: MiddlewareFunction,
  capabilities: readonly SecurityMiddlewareCapability[],
): MiddlewareFunction {
  for (const capability of capabilities) {
    assertSecurityMiddlewareCapability(capability);
  }

  const metadata = getOrCreateSecurityMiddlewareMetadata(middleware);

  for (const capability of capabilities) {
    metadata.capabilities.add(capability);
  }

  return middleware;
}

/**
 * Returns a deterministic immutable copy of the declared security capabilities.
 */
export function getSecurityMiddlewareCapabilities(
  middleware: MiddlewareFunction,
): readonly SecurityMiddlewareCapability[] {
  const metadata = (middleware as MarkedSecurityMiddleware)[SECURITY_MIDDLEWARE_CAPABILITIES_KEY];

  if (!metadata) {
    return Object.freeze([]);
  }

  return Object.freeze(
    SECURITY_MIDDLEWARE_CAPABILITIES.filter((capability) => metadata.capabilities.has(capability)),
  );
}

/**
 * Checks whether a middleware declares a security capability.
 */
export function hasSecurityMiddlewareCapability(
  middleware: MiddlewareFunction,
  capability: SecurityMiddlewareCapability,
): boolean {
  assertSecurityMiddlewareCapability(capability);

  return getSecurityMiddlewareCapabilities(middleware).includes(capability);
}

export function markSecurityMiddleware(
  middleware: MiddlewareFunction,
  exportName: SecurityMiddlewareExportName,
): MiddlewareFunction {
  declareSecurityMiddlewareCapabilities(middleware, [
    SECURITY_MIDDLEWARE_EXPORT_CAPABILITIES[exportName],
  ]);

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

export function getSecurityMiddlewareExportName(
  middleware: MiddlewareFunction,
): SecurityMiddlewareExportName | undefined {
  return (middleware as MarkedSecurityMiddleware)[SECURITY_MIDDLEWARE_EXPORT_KEY];
}

function getOrCreateSecurityMiddlewareMetadata(
  middleware: MiddlewareFunction,
): SecurityMiddlewareMetadata {
  const markedMiddleware = middleware as MarkedSecurityMiddleware;
  const metadata = markedMiddleware[SECURITY_MIDDLEWARE_CAPABILITIES_KEY];

  if (metadata) {
    return metadata;
  }

  const nextMetadata: SecurityMiddlewareMetadata = {
    capabilities: new Set(),
  };

  Object.defineProperty(middleware, SECURITY_MIDDLEWARE_CAPABILITIES_KEY, {
    configurable: false,
    enumerable: false,
    value: nextMetadata,
    writable: false,
  });

  return nextMetadata;
}

function assertSecurityMiddlewareCapability(
  capability: unknown,
): asserts capability is SecurityMiddlewareCapability {
  if (typeof capability !== "string" || !SECURITY_MIDDLEWARE_CAPABILITY_SET.has(capability)) {
    throw ProblemFactory.badRequest(
      "CROCO_HTTP_SECURITY_002",
      `Unsupported security middleware capability: ${String(capability)}`,
      {
        extensions: {
          capability: String(capability),
        },
      },
    );
  }
}
