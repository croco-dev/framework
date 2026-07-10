import { CROCO_PROBLEM_CODE_REGISTRY } from "../generated/problem-code-registry";
import type { Problem, ProblemDetails } from "./Problem";
import { ProblemCategory } from "./ProblemCategory";
import { ProblemCategoryMapper } from "./ProblemCategoryMapper";
import { getProblemRecoveryMetadata, type ProblemRedactionPolicy } from "./ProblemRegistry";

export const OPERATOR_ONLY_PROBLEM_DETAIL = "An internal error occurred";

const RESERVED_PROBLEM_EXTENSION_FIELDS = new Set([
  "type",
  "title",
  "status",
  "code",
  "detail",
  "instance",
  "traceId",
  "requestId",
  "telemetry",
  "__proto__",
  "constructor",
  "prototype",
]);

const PUBLIC_PROBLEM_EXTENSION_FIELDS = new Set([
  "errors",
  "issues",
  "fields",
  "field",
  "formErrors",
  "limit",
  "remaining",
  "resetAt",
  "retryAfter",
  "retryAfterMs",
  "retryAfterSeconds",
  "retryAt",
  "requested",
  "current",
  "max",
  "currentSeats",
  "maxSeats",
  "reason",
  "recoveryAction",
  "legacyCode",
]);

const PROBLEM_REDACTION_POLICIES = new Map<string, ProblemRedactionPolicy>(
  CROCO_PROBLEM_CODE_REGISTRY.problems.map((problem) => [
    problem.code,
    problem.recovery.redactionPolicy,
  ]),
);

export function resolveProblemCodeRedactionPolicy(
  code: string,
  category: ProblemCategory,
): ProblemRedactionPolicy {
  return (
    PROBLEM_REDACTION_POLICIES.get(code) ?? getProblemRecoveryMetadata(category).redactionPolicy
  );
}

export function resolveProblemResponseRedactionPolicy(problem: Problem): ProblemRedactionPolicy {
  return resolveProblemCodeRedactionPolicy(problem.code, problem.category);
}

export function resolveProblemDetailsResponseRedactionPolicy(
  body: ProblemDetails,
  sourceProblem?: Problem,
): ProblemRedactionPolicy {
  if (sourceProblem?.code === body.code) {
    return resolveProblemResponseRedactionPolicy(sourceProblem);
  }

  return resolveProblemCodeRedactionPolicy(
    body.code,
    toFallbackCategory(body.status, sourceProblem),
  );
}

export function createProblemResponseDetail(
  detail: unknown,
  redactionPolicy: ProblemRedactionPolicy,
): string | undefined {
  if (redactionPolicy === "operator-only") {
    return OPERATOR_ONLY_PROBLEM_DETAIL;
  }

  return typeof detail === "string" ? detail : undefined;
}

export function createProblemResponseExtensions(
  extensions: Record<string, unknown> | undefined,
  redactionPolicy: ProblemRedactionPolicy,
): Record<string, unknown> {
  if (redactionPolicy === "operator-only" || !extensions) {
    return {};
  }

  return Object.entries(extensions).reduce(
    (result, [key, value]) => {
      if (!RESERVED_PROBLEM_EXTENSION_FIELDS.has(key) && PUBLIC_PROBLEM_EXTENSION_FIELDS.has(key)) {
        result[key] = value;
      }

      return result;
    },
    {} as Record<string, unknown>,
  );
}

export function extractProblemDetailsResponseExtensions(
  body: ProblemDetails,
): Record<string, unknown> {
  return Object.entries(body).reduce(
    (result, [key, value]) => {
      if (!RESERVED_PROBLEM_EXTENSION_FIELDS.has(key)) {
        result[key] = value;
      }

      return result;
    },
    Object.create(null) as Record<string, unknown>,
  );
}

function toFallbackCategory(status: number, sourceProblem: Problem | undefined): ProblemCategory {
  if (
    sourceProblem !== undefined &&
    ProblemCategoryMapper.toHttpStatus(sourceProblem.category) === status
  ) {
    return sourceProblem.category;
  }

  switch (status) {
    case 400:
      return ProblemCategory.BadRequest;
    case 401:
      return ProblemCategory.Unauthorized;
    case 403:
      return ProblemCategory.Forbidden;
    case 404:
      return ProblemCategory.NotFound;
    case 409:
      return ProblemCategory.Conflict;
    case 410:
      return ProblemCategory.Gone;
    case 422:
      return ProblemCategory.BusinessRuleViolation;
    case 429:
      return ProblemCategory.TooManyRequests;
    case 501:
      return ProblemCategory.NotImplemented;
    default:
      return ProblemCategory.InternalServerError;
  }
}
