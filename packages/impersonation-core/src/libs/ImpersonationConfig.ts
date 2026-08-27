import { Container } from "@croco/framework-context";
import {
  InvalidImpersonationConfigurationProblem,
  type ImpersonationConfigurationConstraint,
} from "./problems/ImpersonationProblems";
import type { ImpersonationConfig } from "./types";
import { IMPERSONATION_CONFIG_TOKEN } from "./types";

const MAX_DATE_TIMESTAMP_MS = 8_640_000_000_000_000;

function invalidConfigurationProblem(
  constraint: Extract<ImpersonationConfigurationConstraint, "object" | "registered">,
  receivedValue: string,
): InvalidImpersonationConfigurationProblem {
  return new InvalidImpersonationConfigurationProblem({
    field: "configuration",
    constraint,
    receivedValue,
  });
}

export function invalidImpersonationDurationProblem(
  value: unknown,
): InvalidImpersonationConfigurationProblem {
  let receivedValue: number | string;
  if (typeof value !== "number") {
    receivedValue = `non-number-${typeof value}`;
  } else if (Number.isFinite(value)) {
    receivedValue = value;
  } else if (Number.isNaN(value)) {
    receivedValue = "NaN";
  } else {
    receivedValue = value === Number.POSITIVE_INFINITY ? "Infinity" : "-Infinity";
  }

  return new InvalidImpersonationConfigurationProblem({
    field: "maxDurationMs",
    constraint: "positive-safe-integer-with-representable-expiration",
    receivedValue,
  });
}

export function assertValidImpersonationConfig(
  config: unknown,
): asserts config is ImpersonationConfig {
  if (typeof config !== "object" || config === null) {
    throw invalidConfigurationProblem(
      "object",
      `non-object-${config === null ? "null" : typeof config}`,
    );
  }

  const candidate = config as Partial<ImpersonationConfig>;
  const maxDurationMs = candidate.maxDurationMs;
  if (
    typeof maxDurationMs !== "number" ||
    !Number.isSafeInteger(maxDurationMs) ||
    maxDurationMs <= 0 ||
    maxDurationMs > MAX_DATE_TIMESTAMP_MS - Date.now()
  ) {
    throw invalidImpersonationDurationProblem(maxDurationMs);
  }

  if (typeof candidate.requireReason !== "boolean") {
    throw new InvalidImpersonationConfigurationProblem({
      field: "requireReason",
      constraint: "boolean",
      receivedValue: `non-boolean-${candidate.requireReason === null ? "null" : typeof candidate.requireReason}`,
    });
  }

  if (!Array.isArray(candidate.blockedActions)) {
    throw new InvalidImpersonationConfigurationProblem({
      field: "blockedActions",
      constraint: "array-of-non-blank-strings",
      receivedValue: "non-array",
    });
  }

  const invalidActionIndex = candidate.blockedActions.findIndex(
    (action) => typeof action !== "string" || action.trim().length === 0,
  );
  if (invalidActionIndex !== -1) {
    throw new InvalidImpersonationConfigurationProblem({
      field: "blockedActions",
      constraint: "array-of-non-blank-strings",
      receivedValue: `invalid-item-at-index-${invalidActionIndex}`,
    });
  }

  const nonNormalizedActionIndex = candidate.blockedActions.findIndex((action) =>
    /\s/u.test(action),
  );
  if (nonNormalizedActionIndex !== -1) {
    throw new InvalidImpersonationConfigurationProblem({
      field: "blockedActions",
      constraint: "normalized-action-identifiers",
      receivedValue: `invalid-item-at-index-${nonNormalizedActionIndex}`,
    });
  }

  const seenActions = new Set<string>();
  const duplicateActionIndex = candidate.blockedActions.findIndex((action) => {
    if (seenActions.has(action)) {
      return true;
    }
    seenActions.add(action);
    return false;
  });
  if (duplicateActionIndex !== -1) {
    throw new InvalidImpersonationConfigurationProblem({
      field: "blockedActions",
      constraint: "unique-action-identifiers",
      receivedValue: `duplicate-item-at-index-${duplicateActionIndex}`,
    });
  }
}

export function resolveImpersonationConfig(): ImpersonationConfig {
  const config: unknown = Container.getOptional(IMPERSONATION_CONFIG_TOKEN);
  if (config === undefined) {
    throw invalidConfigurationProblem("registered", "missing");
  }
  assertValidImpersonationConfig(config);
  return config;
}
