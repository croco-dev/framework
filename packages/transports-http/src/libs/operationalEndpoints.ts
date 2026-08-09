import {
  DiagnosticsCollector,
  type DiagnosticsReport,
  type DiagnosticsProvider,
  type ErrorRecord,
  type HealthStatus,
} from "@croco/diagnostics-core";
import { EventBusDiagnosticsProvider } from "@croco/events-core";
import { ContainerDiagnosticsProvider } from "@croco/framework-context";
import type { Context as HonoContext } from "hono";
import type { HealthCheckRegistryResult } from "./HealthCheckRegistry";
import { DiagnosticsConfigurationProblem } from "./problems/DiagnosticsEndpointProblems";

export const DIAGNOSTICS_ENDPOINT_PATH = "/health/diagnostics";
export const STANDARD_DIAGNOSTICS_ENDPOINT_PATH = "/diagnostics";
export const METRICS_ENDPOINT_PATH = "/metrics";
export const DIAGNOSTICS_TOKEN_HEADER = "X-Diagnostics-Token";
export const OPERATIONAL_ENDPOINT_PATHS = [
  "/health",
  "/health/live",
  "/ready",
  "/health/ready",
  STANDARD_DIAGNOSTICS_ENDPOINT_PATH,
  DIAGNOSTICS_ENDPOINT_PATH,
  METRICS_ENDPOINT_PATH,
] as const;

const DEFAULT_RECENT_ERROR_LIMIT = 100;
const DEFAULT_MESSAGE_LIMIT = 100;
const OMITTED_DIAGNOSTIC_KEYS = new Set(["cause", "stack"]);
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|database[-_]?url|redis[-_]?url|mongo(?:db)?[-_]?url|postgres(?:ql)?[-_]?url|connection[-_]?string|dsn/i;

type RedactionOptions = {
  readonly messageLimit?: number;
  readonly omitDiagnosticInternals?: boolean;
};

export type DiagnosticsExposureMode = "off" | "private" | "token" | "custom";

export type DiagnosticsAccessContext = {
  readonly method: string;
  readonly path: string;
  readonly request: Request;
  header(name: string): string | undefined;
};

export type DiagnosticsGuard = (context: DiagnosticsAccessContext) => boolean | Promise<boolean>;

export type DiagnosticsEndpointOptions = {
  readonly exposure?: DiagnosticsExposureMode;
  readonly token?: string;
  readonly tokenHeader?: string;
  readonly guard?: DiagnosticsGuard;
  readonly collector?: DiagnosticsCollector;
  readonly providers?: readonly DiagnosticsProvider[];
  readonly recentErrorLimit?: number;
  readonly messageLimit?: number;
};

export type DiagnosticsEndpointPolicy = Required<
  Pick<DiagnosticsEndpointOptions, "exposure" | "tokenHeader" | "recentErrorLimit" | "messageLimit">
> &
  Pick<DiagnosticsEndpointOptions, "token" | "guard" | "collector" | "providers">;

export type OperationalLivenessResponse = {
  readonly status: "ok";
};

export type OperationalMetricsResponse = {
  readonly timestamp: string;
  readonly metrics: {
    readonly standardEndpointPathCount: number;
    readonly healthCheckCount: number;
  };
};

export type SafeDiagnosticsErrorRecord = Omit<ErrorRecord, "cause">;

export type SafeDiagnosticsReport = Omit<DiagnosticsReport, "recentErrors"> & {
  readonly recentErrors: readonly SafeDiagnosticsErrorRecord[];
};

export function createDefaultDiagnosticsCollector(
  providers: readonly DiagnosticsProvider[] = [],
): DiagnosticsCollector {
  const collector = new DiagnosticsCollector();
  collector.registerProvider(new RuntimeDiagnosticsProvider());

  collector.registerProvider(new ContainerDiagnosticsProvider());
  collector.registerProvider(new EventBusDiagnosticsProvider());

  for (const provider of providers) {
    collector.registerProvider(provider);
  }

  return collector;
}

class RuntimeDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "runtime";

  async getHealth(): Promise<HealthStatus> {
    return {
      status: "healthy",
      component: "runtime",
      details: getRuntimeMetadata(),
      lastChecked: new Date().toISOString(),
    };
  }
}

function getRuntimeMetadata(): Record<string, unknown> {
  return {
    runtime: "node",
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

export function resolveDiagnosticsEndpointPolicy(
  options: DiagnosticsEndpointOptions | undefined,
  env: NodeJS.ProcessEnv = process.env,
): DiagnosticsEndpointPolicy {
  const envExposure = parseDiagnosticsExposure(env.CROCO_DIAGNOSTICS_EXPOSURE);
  const legacyEnabled = env.CROCO_DIAGNOSTICS_ENABLED === "true";
  const token = options?.token ?? env.CROCO_DIAGNOSTICS_TOKEN;
  const exposure =
    options?.exposure ?? envExposure ?? (legacyEnabled ? (token ? "token" : "private") : "off");
  const recentErrorLimit =
    options?.recentErrorLimit === undefined ? DEFAULT_RECENT_ERROR_LIMIT : options.recentErrorLimit;
  const messageLimit =
    options?.messageLimit === undefined ? DEFAULT_MESSAGE_LIMIT : options.messageLimit;

  assertDiagnosticsLimit("recentErrorLimit", recentErrorLimit, 0);
  assertDiagnosticsLimit("messageLimit", messageLimit, 1);

  return {
    exposure,
    token,
    tokenHeader: options?.tokenHeader ?? DIAGNOSTICS_TOKEN_HEADER,
    guard: options?.guard,
    collector: options?.collector,
    providers: options?.providers,
    recentErrorLimit,
    messageLimit,
  };
}

function assertDiagnosticsLimit(
  option: "messageLimit" | "recentErrorLimit",
  value: number,
  minimum: number,
): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new DiagnosticsConfigurationProblem({
      option,
      receivedValue: String(value),
    });
  }
}

export async function authorizeDiagnosticsRequest(
  context: HonoContext,
  policy: DiagnosticsEndpointPolicy,
): Promise<boolean> {
  if (policy.exposure === "off") {
    return false;
  }

  if (policy.exposure === "private") {
    return true;
  }

  if (policy.exposure === "token") {
    return Boolean(policy.token) && context.req.header(policy.tokenHeader) === policy.token;
  }

  if (!policy.guard) {
    return false;
  }

  return policy.guard({
    method: context.req.method,
    path: context.req.path,
    request: context.req.raw,
    header: (name) => context.req.header(name),
  });
}

export function sanitizeDiagnosticsReport(
  report: DiagnosticsReport,
  policy: Pick<DiagnosticsEndpointPolicy, "recentErrorLimit" | "messageLimit">,
): SafeDiagnosticsReport {
  return {
    ...report,
    components: report.components.map((component) => ({
      ...component,
      ...(component.message ? { message: capMessage(component.message, policy.messageLimit) } : {}),
      ...(component.details
        ? { details: redactValue(component.details) as Record<string, unknown> }
        : {}),
    })),
    recentErrors: report.recentErrors.slice(0, policy.recentErrorLimit).map((error) => ({
      timestamp: error.timestamp,
      component: error.component,
      code: error.code,
      message: capMessage(error.message, policy.messageLimit),
    })),
  };
}

const DEFAULT_HEALTH_DETAIL_STRING_LIMIT = 100;
const DEFAULT_HEALTH_DETAIL_COLLECTION_LIMIT = 50;
const DEFAULT_HEALTH_DETAIL_NODE_LIMIT = 500;
const DEFAULT_HEALTH_DETAIL_CHARACTER_LIMIT = 10_000;

type RedactionBudget = {
  remainingNodes: number;
  remainingCharacters: number;
};

type HealthDetailRedactionOptions = RedactionOptions & {
  readonly stringLimit?: number;
  readonly collectionLimit?: number;
  readonly budget?: RedactionBudget;
};

export function sanitizeHealthCheckResult(
  result: HealthCheckRegistryResult,
  messageLimit = DEFAULT_MESSAGE_LIMIT,
): HealthCheckRegistryResult {
  const stringLimit = Math.min(messageLimit, DEFAULT_HEALTH_DETAIL_STRING_LIMIT);

  return {
    ...result,
    results: result.results.map((indicator) => ({
      ...indicator,
      ...(indicator.details
        ? {
            details: redactValue(indicator.details, 0, {
              messageLimit: stringLimit,
              stringLimit,
              collectionLimit: DEFAULT_HEALTH_DETAIL_COLLECTION_LIMIT,
              omitDiagnosticInternals: true,
              budget: {
                remainingNodes: DEFAULT_HEALTH_DETAIL_NODE_LIMIT,
                remainingCharacters: DEFAULT_HEALTH_DETAIL_CHARACTER_LIMIT,
              },
            }) as typeof indicator.details,
          }
        : {}),
    })),
  };
}

export function createOperationalMetricsResponse(
  healthCheckCount: number,
): OperationalMetricsResponse {
  return {
    timestamp: new Date().toISOString(),
    metrics: {
      standardEndpointPathCount: OPERATIONAL_ENDPOINT_PATHS.length,
      healthCheckCount,
    },
  };
}

function parseDiagnosticsExposure(value: string | undefined): DiagnosticsExposureMode | undefined {
  if (value === "off" || value === "private" || value === "token" || value === "custom") {
    return value;
  }

  return undefined;
}

function capMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message;
  }

  if (maxLength <= 3) {
    return message.slice(0, maxLength);
  }

  return `${message.slice(0, maxLength - 3)}...`;
}

function redactValue(
  value: unknown,
  depth = 0,
  options: HealthDetailRedactionOptions = {},
): unknown {
  if (!consumeNode(options.budget)) {
    return undefined;
  }

  if (depth > 5) {
    return consumeString("[Truncated]", options.budget);
  }

  if (Array.isArray(value)) {
    const items: unknown[] = [];
    const limit = options.collectionLimit ?? value.length;

    for (let index = 0; index < value.length && index < limit; index += 1) {
      if (!hasBudget(options.budget)) {
        break;
      }
      items.push(redactValue(value[index], depth + 1, options));
    }

    return items;
  }

  if (typeof value === "string" && options.stringLimit !== undefined) {
    return consumeString(capMessage(value, options.stringLimit), options.budget);
  }

  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    return undefined;
  }

  if (!isRecord(value)) {
    return value;
  }

  const redacted = Object.create(null) as Record<string, unknown>;
  const limit = options.collectionLimit ?? Number.POSITIVE_INFINITY;
  let includedEntries = 0;

  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      continue;
    }
    if (includedEntries >= limit) {
      break;
    }
    if (!hasBudget(options.budget) || !consumeKey(key, options.budget)) {
      break;
    }
    includedEntries += 1;
    if (options.omitDiagnosticInternals && OMITTED_DIAGNOSTIC_KEYS.has(key.toLowerCase())) {
      continue;
    }

    if (SENSITIVE_KEY_PATTERN.test(key)) {
      redacted[key] = consumeNode(options.budget)
        ? consumeString("[Redacted]", options.budget)
        : undefined;
      continue;
    }

    const entry = value[key];

    if (
      options.messageLimit !== undefined &&
      (key === "error" || key === "message") &&
      typeof entry === "string"
    ) {
      redacted[key] = consumeNode(options.budget)
        ? consumeString(capMessage(entry, options.messageLimit), options.budget)
        : undefined;
      continue;
    }

    redacted[key] = redactValue(entry, depth + 1, options);
  }

  return redacted;
}

function hasBudget(budget: RedactionBudget | undefined): boolean {
  return budget === undefined || (budget.remainingNodes > 0 && budget.remainingCharacters > 0);
}

function consumeNode(budget: RedactionBudget | undefined): boolean {
  if (budget === undefined) {
    return true;
  }
  if (budget.remainingNodes <= 0 || budget.remainingCharacters <= 0) {
    return false;
  }

  budget.remainingNodes -= 1;
  return true;
}

function consumeKey(key: string, budget: RedactionBudget | undefined): boolean {
  if (budget === undefined) {
    return true;
  }
  if (key.length > budget.remainingCharacters) {
    return false;
  }

  budget.remainingCharacters -= key.length;
  return true;
}

function consumeString(value: string, budget: RedactionBudget | undefined): string {
  if (budget === undefined) {
    return value;
  }

  const consumed = value.slice(0, budget.remainingCharacters);
  budget.remainingCharacters -= consumed.length;
  return consumed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
