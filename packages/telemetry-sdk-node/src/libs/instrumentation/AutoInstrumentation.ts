import type { Instrumentation } from "@opentelemetry/instrumentation";

/**
 * Auto-instrumentation modules that can be enabled.
 * These map to popular Node.js libraries and frameworks.
 */
export type AutoInstrumentationModule =
  | "http"
  | "https"
  | "express"
  | "fastify"
  | "koa"
  | "restify"
  | "nest"
  | "aws-sdk"
  | "aws-lambda"
  | "dns"
  | "net"
  | "fs"
  | "graphql"
  | "grpc"
  | "ioredis"
  | "mongodb"
  | "mysql"
  | "mysql2"
  | "pg"
  | "redis"
  | "bunyan"
  | "pino"
  | "winston";

/**
 * Configuration for auto-instrumentation.
 * Defines which modules should be automatically instrumented.
 *
 * @example
 * ```typescript
 * const autoInstrumentConfig: AutoInstrumentationConfig = {
 *   enabled: true,
 *   modules: ['http', 'express', 'pg'],
 *   exclude: ['http.server.request'], // Exclude specific operations
 * };
 * ```
 */
export interface AutoInstrumentationConfig {
  /**
   * Whether auto-instrumentation is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * List of modules to auto-instrument.
   * If not specified, all available modules will be instrumented.
   */
  modules?: AutoInstrumentationModule[];

  /**
   * List of modules to exclude from auto-instrumentation.
   * Takes precedence over 'modules'.
   */
  excludeModules?: AutoInstrumentationModule[];

  /**
   * Custom instrumentation instances to include.
   * These are merged with auto-loaded instrumentations.
   */
  customInstrumentations?: Instrumentation[];

  /**
   * Configuration for specific instrumentations.
   * Keys are module names, values are module-specific options.
   */
  moduleOptions?: Record<string, Record<string, unknown>>;

  /**
   * Patterns for operation names to exclude.
   * Supports simple wildcards with '*'.
   * @example ['health.check', 'metrics.*']
   */
  exclude?: string[];

  /**
   * Patterns for operation names to include (whitelist).
   * If specified, only matching operations are instrumented.
   * @example ['api.*', 'service.*']
   */
  include?: string[];
}

/**
 * Default modules enabled for Lambda environments.
 * Optimized for minimal overhead and maximum utility.
 */
export const LAMBDA_DEFAULT_MODULES: AutoInstrumentationModule[] = [
  "http",
  "https",
  "aws-sdk",
  "aws-lambda",
];

/**
 * Default modules enabled for standard Node.js applications.
 * Includes common web framework and database instrumentations.
 */
export const NODE_DEFAULT_MODULES: AutoInstrumentationModule[] = [
  "http",
  "https",
  "express",
  "fastify",
  "dns",
  "net",
];

/**
 * Creates a safe auto-instrumentation configuration.
 * Filters out unavailable modules and applies defaults.
 *
 * @param config - User-provided configuration
 * @param environment - Target environment ('lambda' | 'node')
 * @returns Normalized configuration
 */
export function normalizeAutoInstrumentationConfig(
  config: AutoInstrumentationConfig | undefined,
  environment: "lambda" | "node",
): Required<Pick<AutoInstrumentationConfig, "enabled">> &
  Omit<AutoInstrumentationConfig, "enabled"> {
  const defaultModules = environment === "lambda" ? LAMBDA_DEFAULT_MODULES : NODE_DEFAULT_MODULES;

  if (!config || config.enabled === false) {
    return {
      enabled: false,
      modules: [],
      excludeModules: [],
      customInstrumentations: [],
      moduleOptions: {},
      exclude: [],
      include: [],
    };
  }

  return {
    enabled: config.enabled ?? true,
    modules: config.modules ?? defaultModules,
    excludeModules: config.excludeModules ?? [],
    customInstrumentations: config.customInstrumentations ?? [],
    moduleOptions: config.moduleOptions ?? {},
    exclude: config.exclude ?? [],
    include: config.include ?? [],
  };
}
