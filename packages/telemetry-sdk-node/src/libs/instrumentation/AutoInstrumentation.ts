import type { Instrumentation } from "@opentelemetry/instrumentation";
import type { InstrumentationConfigMap } from "@opentelemetry/auto-instrumentations-node";
import { TelemetryAutoInstrumentationProblem } from "../problems/TelemetryAutoInstrumentationProblem";

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
 *   modules: ['http', 'https', 'express', 'pg'],
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
   * Unsupported operation exclusion filters.
   * Non-empty values fail SDK startup because the Node instrumentation bundle cannot apply them
   * consistently across modules.
   * @deprecated Use module-specific supported options or custom instrumentation instances.
   */
  exclude?: string[];

  /**
   * Unsupported operation inclusion filters.
   * Non-empty values fail SDK startup because the Node instrumentation bundle cannot apply them
   * consistently across modules.
   * @deprecated Use module-specific supported options or custom instrumentation instances.
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
  "dns",
  "net",
];

type UpstreamInstrumentationName = keyof InstrumentationConfigMap;

const MODULE_NAMES: Record<
  Exclude<AutoInstrumentationModule, "fastify">,
  UpstreamInstrumentationName
> = {
  http: "@opentelemetry/instrumentation-http",
  https: "@opentelemetry/instrumentation-http",
  express: "@opentelemetry/instrumentation-express",
  koa: "@opentelemetry/instrumentation-koa",
  restify: "@opentelemetry/instrumentation-restify",
  nest: "@opentelemetry/instrumentation-nestjs-core",
  "aws-sdk": "@opentelemetry/instrumentation-aws-sdk",
  "aws-lambda": "@opentelemetry/instrumentation-aws-lambda",
  dns: "@opentelemetry/instrumentation-dns",
  net: "@opentelemetry/instrumentation-net",
  fs: "@opentelemetry/instrumentation-fs",
  graphql: "@opentelemetry/instrumentation-graphql",
  grpc: "@opentelemetry/instrumentation-grpc",
  ioredis: "@opentelemetry/instrumentation-ioredis",
  mongodb: "@opentelemetry/instrumentation-mongodb",
  mysql: "@opentelemetry/instrumentation-mysql",
  mysql2: "@opentelemetry/instrumentation-mysql2",
  pg: "@opentelemetry/instrumentation-pg",
  redis: "@opentelemetry/instrumentation-redis",
  bunyan: "@opentelemetry/instrumentation-bunyan",
  pino: "@opentelemetry/instrumentation-pino",
  winston: "@opentelemetry/instrumentation-winston",
};

const SUPPORTED_MODULE_OPTION_KEYS: Partial<Record<AutoInstrumentationModule, readonly string[]>> =
  {
    pg: ["enhancedDatabaseReporting"],
  };

const UPSTREAM_INSTRUMENTATION_NAMES: UpstreamInstrumentationName[] = [
  "@opentelemetry/instrumentation-amqplib",
  "@opentelemetry/instrumentation-aws-lambda",
  "@opentelemetry/instrumentation-aws-sdk",
  "@opentelemetry/instrumentation-bunyan",
  "@opentelemetry/instrumentation-cassandra-driver",
  "@opentelemetry/instrumentation-connect",
  "@opentelemetry/instrumentation-cucumber",
  "@opentelemetry/instrumentation-dataloader",
  "@opentelemetry/instrumentation-dns",
  "@opentelemetry/instrumentation-express",
  "@opentelemetry/instrumentation-fs",
  "@opentelemetry/instrumentation-generic-pool",
  "@opentelemetry/instrumentation-graphql",
  "@opentelemetry/instrumentation-grpc",
  "@opentelemetry/instrumentation-hapi",
  "@opentelemetry/instrumentation-http",
  "@opentelemetry/instrumentation-ioredis",
  "@opentelemetry/instrumentation-kafkajs",
  "@opentelemetry/instrumentation-knex",
  "@opentelemetry/instrumentation-koa",
  "@opentelemetry/instrumentation-lru-memoizer",
  "@opentelemetry/instrumentation-memcached",
  "@opentelemetry/instrumentation-mongodb",
  "@opentelemetry/instrumentation-mongoose",
  "@opentelemetry/instrumentation-mysql2",
  "@opentelemetry/instrumentation-mysql",
  "@opentelemetry/instrumentation-nestjs-core",
  "@opentelemetry/instrumentation-net",
  "@opentelemetry/instrumentation-openai",
  "@opentelemetry/instrumentation-oracledb",
  "@opentelemetry/instrumentation-pg",
  "@opentelemetry/instrumentation-pino",
  "@opentelemetry/instrumentation-redis",
  "@opentelemetry/instrumentation-restify",
  "@opentelemetry/instrumentation-router",
  "@opentelemetry/instrumentation-runtime-node",
  "@opentelemetry/instrumentation-socket.io",
  "@opentelemetry/instrumentation-tedious",
  "@opentelemetry/instrumentation-undici",
  "@opentelemetry/instrumentation-winston",
];

export type ResolvedAutoInstrumentation = {
  instrumentations: Instrumentation[];
  enabledModules: string[];
};

function getInstrumentationName(instrumentation: Instrumentation): string {
  return instrumentation.instrumentationName ?? "";
}

export function mergeCustomInstrumentations(...groups: Instrumentation[][]): Instrumentation[] {
  const seenNames = new Set<string>();
  const seenInstances = new Set<Instrumentation>();
  const merged: Instrumentation[] = [];

  for (const instrumentation of groups.flat()) {
    const name = getInstrumentationName(instrumentation);
    if (seenInstances.has(instrumentation) || (name.length > 0 && seenNames.has(name))) {
      continue;
    }
    seenInstances.add(instrumentation);
    if (name.length > 0) {
      seenNames.add(name);
    }
    merged.push(instrumentation);
  }

  return merged;
}

function resolveModuleName(module: AutoInstrumentationModule): UpstreamInstrumentationName {
  if (module === "fastify") {
    throw new TelemetryAutoInstrumentationProblem(
      "Auto-instrumentation module 'fastify' is not available in the installed OpenTelemetry bundle",
    );
  }
  if (!Object.prototype.hasOwnProperty.call(MODULE_NAMES, module)) {
    throw new TelemetryAutoInstrumentationProblem("Unknown auto-instrumentation module");
  }
  return MODULE_NAMES[module as Exclude<AutoInstrumentationModule, "fastify">];
}

/** Canonicalizes user-facing module aliases to the effective upstream instrumentation order. */
export function canonicalizeAutoInstrumentationModuleSelection(
  modules: readonly AutoInstrumentationModule[],
): UpstreamInstrumentationName[] {
  const selectedNames: UpstreamInstrumentationName[] = [];
  for (const module of modules) {
    const name = resolveModuleName(module);
    if (!selectedNames.includes(name)) {
      selectedNames.push(name);
    }
  }
  return selectedNames;
}

export type AutoInstrumentationConfigPlan = {
  normalized: ReturnType<typeof normalizeAutoInstrumentationConfig>;
  selectedNames: UpstreamInstrumentationName[];
  optionsByName: Map<UpstreamInstrumentationName, Record<string, unknown>>;
};

/** Validates configuration and returns the effective upstream plan without loading instrumentations. */
export function createAutoInstrumentationConfigPlan(
  config: AutoInstrumentationConfig | undefined,
  environment: "lambda" | "node",
): AutoInstrumentationConfigPlan {
  const normalized = normalizeAutoInstrumentationConfig(config, environment);
  if (normalized.enabled === false) {
    return { normalized, selectedNames: [], optionsByName: new Map() };
  }

  if (normalized.include && normalized.include.length > 0) {
    throw new TelemetryAutoInstrumentationProblem(
      "Operation include filters are not supported by Node auto-instrumentation",
    );
  }
  if (normalized.exclude && normalized.exclude.length > 0) {
    throw new TelemetryAutoInstrumentationProblem(
      "Operation exclude filters are not supported by Node auto-instrumentation",
    );
  }

  const modules = new Set(normalized.modules ?? []);
  if (modules.has("http") !== modules.has("https")) {
    throw new TelemetryAutoInstrumentationProblem(
      "The 'http' and 'https' modules must be selected together because OpenTelemetry provides one shared instrumentation",
    );
  }
  const excludedModules = new Set(normalized.excludeModules ?? []);
  if (excludedModules.has("http") !== excludedModules.has("https")) {
    throw new TelemetryAutoInstrumentationProblem(
      "The 'http' and 'https' modules must be excluded together because OpenTelemetry provides one shared instrumentation",
    );
  }

  const excluded = new Set([...excludedModules].map(resolveModuleName));
  const selectedNames = canonicalizeAutoInstrumentationModuleSelection(
    normalized.modules ?? [],
  ).filter((name) => !excluded.has(name));

  const optionsByName = new Map<UpstreamInstrumentationName, Record<string, unknown>>();
  for (const [module, options] of Object.entries(normalized.moduleOptions ?? {})) {
    const typedModule = module as AutoInstrumentationModule;
    const name = resolveModuleName(typedModule);
    if (!selectedNames.includes(name)) {
      throw new TelemetryAutoInstrumentationProblem(
        `Module options target disabled or unselected module '${module}'`,
      );
    }
    if (optionsByName.has(name)) {
      throw new TelemetryAutoInstrumentationProblem(
        `Multiple module option entries target '${name}'`,
      );
    }
    if ("enabled" in options) {
      throw new TelemetryAutoInstrumentationProblem(
        `Module option 'enabled' must be configured through modules/excludeModules for '${module}'`,
      );
    }
    const supportedKeys = SUPPORTED_MODULE_OPTION_KEYS[typedModule] ?? [];
    const unsupportedKeys = Object.keys(options).filter((key) => !supportedKeys.includes(key));
    if (unsupportedKeys.length > 0) {
      throw new TelemetryAutoInstrumentationProblem(`Unsupported module options for '${module}'`);
    }
    optionsByName.set(name, options);
  }

  return { normalized, selectedNames, optionsByName };
}

export async function resolveAutoInstrumentation(
  config: AutoInstrumentationConfig | undefined,
  environment: "lambda" | "node",
  traceInstrumentations: Instrumentation[],
): Promise<ResolvedAutoInstrumentation> {
  const { normalized, optionsByName, selectedNames } = createAutoInstrumentationConfigPlan(
    config,
    environment,
  );
  if (normalized.enabled === false) {
    return {
      instrumentations: mergeCustomInstrumentations(traceInstrumentations),
      enabledModules: [],
    };
  }

  const upstreamConfig = Object.fromEntries(
    UPSTREAM_INSTRUMENTATION_NAMES.map((name) => [
      name,
      selectedNames.includes(name)
        ? { ...optionsByName.get(name), enabled: true }
        : { enabled: false },
    ]),
  ) as InstrumentationConfigMap;
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
  const automatic = getNodeAutoInstrumentations(upstreamConfig);
  const custom = mergeCustomInstrumentations(
    traceInstrumentations,
    normalized.customInstrumentations ?? [],
  );
  const customNames = new Set(custom.map(getInstrumentationName));
  const automaticByName = new Map(
    automatic.map((instrumentation) => [getInstrumentationName(instrumentation), instrumentation]),
  );
  const deduplicatedAutomatic = selectedNames.flatMap((name) => {
    const instrumentation = automaticByName.get(name);
    return instrumentation && !customNames.has(name) ? [instrumentation] : [];
  });

  return {
    instrumentations: [...custom, ...deduplicatedAutomatic],
    enabledModules: deduplicatedAutomatic.map(getInstrumentationName),
  };
}

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
