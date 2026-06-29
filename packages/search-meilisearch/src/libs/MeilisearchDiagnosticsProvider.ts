import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { Problem } from "@croco/problems-core";
import { MeiliSearch } from "meilisearch";
import {
  createSafeMeilisearchConfigDetails,
  validateMeilisearchOptions,
} from "./MeilisearchConfig";
import { normalizeMeilisearchError } from "./problems/MeilisearchProblems";
import type { MeilisearchEngineOptions } from "./types";

export type MeilisearchReadinessCheckContext = {
  readonly client: MeiliSearch;
  readonly config: MeilisearchEngineOptions;
  readonly signal?: AbortSignal;
};

export type MeilisearchReadinessCheckResult = {
  readonly details?: Record<string, unknown>;
  readonly message?: string;
};

export type MeilisearchDiagnosticsOptions = {
  readonly readinessCheck?: (
    context: MeilisearchReadinessCheckContext,
  ) => Promise<MeilisearchReadinessCheckResult | void>;
};

export class MeilisearchDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "search-meilisearch";

  constructor(
    private readonly config: Partial<MeilisearchEngineOptions>,
    private readonly options: MeilisearchDiagnosticsOptions = {},
  ) {}

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    const baseDetails = createSafeMeilisearchConfigDetails(this.config);
    let validConfig: MeilisearchEngineOptions;

    try {
      validConfig = validateMeilisearchOptions(this.config);
    } catch (error) {
      const problem =
        error instanceof Problem
          ? error
          : normalizeMeilisearchError(error, { operation: "configuration" });

      return {
        status: "unhealthy",
        component: this.name,
        message: sanitizeDiagnosticMessage(problem.detail),
        details: {
          ...baseDetails,
          liveCheck: "not_started",
          problemCode: problem.code,
          problemStatus: problem.status,
        },
        lastChecked: new Date().toISOString(),
      };
    }

    if (!this.options.readinessCheck) {
      return {
        status: "healthy",
        component: this.name,
        message:
          "Meilisearch configuration is present; live upstream readiness check is not configured",
        details: {
          ...baseDetails,
          liveCheck: "not_configured",
        },
        lastChecked: new Date().toISOString(),
      };
    }

    try {
      const client = new MeiliSearch({
        host: validConfig.host,
        apiKey: validConfig.apiKey,
      });
      const result = await this.options.readinessCheck({ client, config: validConfig, signal });

      return {
        status: "healthy",
        component: this.name,
        message: sanitizeDiagnosticMessage(result?.message ?? "Meilisearch readiness check passed"),
        details: {
          ...baseDetails,
          liveCheck: "passed",
          ...(result?.details && { readiness: sanitizeDiagnosticValue(result.details) }),
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const problem = normalizeMeilisearchError(error, { operation: "readiness" });

      return {
        status: "degraded",
        component: this.name,
        message: sanitizeDiagnosticMessage(problem.detail),
        details: {
          ...baseDetails,
          ...sanitizeDiagnosticDetails(problem.extensions),
          liveCheck: "failed",
          problemCode: problem.code,
          problemStatus: problem.status,
        },
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

const SENSITIVE_DIAGNOSTIC_KEY_PATTERN =
  "authorization|cookie|password|secret|token|api[-_]?key|access[-_]?key|access[-_]?token";
const SENSITIVE_DIAGNOSTIC_KEY = new RegExp(`(${SENSITIVE_DIAGNOSTIC_KEY_PATTERN})`, "i");
const SENSITIVE_DIAGNOSTIC_QUERY_PARAM = new RegExp(
  `([?&](${SENSITIVE_DIAGNOSTIC_KEY_PATTERN})=)[^&#\\s]+`,
  "gi",
);
const SENSITIVE_DIAGNOSTIC_ASSIGNMENT = new RegExp(
  `(["']?\\b(${SENSITIVE_DIAGNOSTIC_KEY_PATTERN})\\b["']?\\s*[:=]\\s*)(["']?)([^"',\\s;&}]+)\\3`,
  "gi",
);
const SENSITIVE_DIAGNOSTIC_HEADER = /\b(authorization|cookie)(\s*[:=]\s*)[^,\n;]+/gi;

function sanitizeDiagnosticDetails(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeDiagnosticValue(value);
  return typeof sanitized === "object" && sanitized !== null && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
}

function sanitizeDiagnosticMessage(value: string | undefined): string | undefined {
  return value === undefined ? undefined : redactDiagnosticText(value);
}

function sanitizeDiagnosticValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDiagnosticValue(item));
  }

  if (typeof value === "string") {
    return redactDiagnosticText(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
    };
  }

  if (typeof value === "object" && value !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      sanitized[key] = SENSITIVE_DIAGNOSTIC_KEY.test(key)
        ? "[redacted]"
        : sanitizeDiagnosticValue(nestedValue);
    }
    return sanitized;
  }

  return value;
}

function redactDiagnosticText(value: string): string {
  return value
    .replace(SENSITIVE_DIAGNOSTIC_HEADER, "$1$2[redacted]")
    .replace(SENSITIVE_DIAGNOSTIC_QUERY_PARAM, "$1[redacted]")
    .replace(SENSITIVE_DIAGNOSTIC_ASSIGNMENT, "$1$3[redacted]$3");
}
