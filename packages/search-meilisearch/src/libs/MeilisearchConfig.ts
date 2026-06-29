import {
  MissingMeilisearchConfigProblem,
  MeilisearchInvalidRequestProblem,
} from "./problems/MeilisearchProblems";
import type { MeilisearchEngineOptions } from "./types";

export function validateMeilisearchOptions(
  options: Partial<MeilisearchEngineOptions>,
): MeilisearchEngineOptions {
  if (!isNonEmptyString(options.host)) {
    throw new MissingMeilisearchConfigProblem("host");
  }

  if (!isNonEmptyString(options.apiKey)) {
    throw new MissingMeilisearchConfigProblem("apiKey");
  }

  if (options.tenantTokenOptions && !isNonEmptyString(options.tenantTokenOptions.apiKeyUid)) {
    throw new MissingMeilisearchConfigProblem("tenantTokenOptions.apiKeyUid");
  }

  validatePositiveInteger(options.taskWait?.timeoutMs, "taskWait.timeoutMs");
  validatePositiveInteger(options.taskWait?.intervalMs, "taskWait.intervalMs");

  return options as MeilisearchEngineOptions;
}

export function createSafeMeilisearchConfigDetails(
  options: Partial<MeilisearchEngineOptions>,
): Record<string, unknown> {
  return {
    provider: "meilisearch",
    hasHost: isNonEmptyString(options.host),
    hasApiKey: isNonEmptyString(options.apiKey),
    hasTenantTokenOptions: options.tenantTokenOptions !== undefined,
    hasTenantTokenApiKeyUid: isNonEmptyString(options.tenantTokenOptions?.apiKeyUid),
    taskWaitEnabled: options.taskWait?.enabled ?? true,
  };
}

function validatePositiveInteger(value: unknown, label: string): void {
  if (value === undefined) {
    return;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new MeilisearchInvalidRequestProblem({
      operation: "configuration",
      upstreamCode: `invalid-${label}`,
    });
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
