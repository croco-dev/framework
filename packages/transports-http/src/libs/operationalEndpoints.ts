import {
  DiagnosticsCollector,
  type DiagnosticsReport,
  type ErrorRecord,
} from "@croco/diagnostics-core";
import { EventBusDiagnosticsProvider } from "@croco/events-core";
import { ContainerDiagnosticsProvider } from "@croco/framework-context";
import type { Context as HonoContext } from "hono";

export const DIAGNOSTICS_ENDPOINT_PATH = "/health/diagnostics";
export const DIAGNOSTICS_TOKEN_HEADER = "X-Diagnostics-Token";

const DEFAULT_RECENT_ERROR_LIMIT = 100;
const DEFAULT_MESSAGE_LIMIT = 100;
const SENSITIVE_KEY_PATTERN = /authorization|cookie|credential|password|secret|token|api[-_]?key/i;

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
  readonly recentErrorLimit?: number;
  readonly messageLimit?: number;
};

export type DiagnosticsEndpointPolicy = Required<
  Pick<DiagnosticsEndpointOptions, "exposure" | "tokenHeader" | "recentErrorLimit" | "messageLimit">
> &
  Pick<DiagnosticsEndpointOptions, "token" | "guard" | "collector">;

export type OperationalLivenessResponse = {
  readonly status: "ok";
};

export type SafeDiagnosticsErrorRecord = Omit<ErrorRecord, "cause">;

export type SafeDiagnosticsReport = Omit<DiagnosticsReport, "recentErrors"> & {
  readonly recentErrors: readonly SafeDiagnosticsErrorRecord[];
};

export function createDefaultDiagnosticsCollector(): DiagnosticsCollector {
  const collector = new DiagnosticsCollector();

  try {
    collector.registerProvider(new ContainerDiagnosticsProvider());
  } catch {
    /* provider unavailable */
  }

  try {
    collector.registerProvider(new EventBusDiagnosticsProvider());
  } catch {
    /* provider unavailable */
  }

  return collector;
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

  return {
    exposure,
    token,
    tokenHeader: options?.tokenHeader ?? DIAGNOSTICS_TOKEN_HEADER,
    guard: options?.guard,
    collector: options?.collector,
    recentErrorLimit: options?.recentErrorLimit ?? DEFAULT_RECENT_ERROR_LIMIT,
    messageLimit: options?.messageLimit ?? DEFAULT_MESSAGE_LIMIT,
  };
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

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return "[Truncated]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[Redacted]" : redactValue(entry, depth + 1),
    ]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
