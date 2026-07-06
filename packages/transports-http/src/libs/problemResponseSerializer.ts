import {
  CROCO_PROBLEM_CODE_REGISTRY,
  getProblemRecoveryMetadata,
  ProblemCategory,
  ProblemCategoryMapper,
  type Problem,
  type ProblemDetails,
  type ProblemRedactionPolicy,
} from "@croco/problems-core";

const OPERATOR_ONLY_DETAIL = "An internal error occurred";

const PROBLEM_REDACTION_POLICIES = new Map<string, ProblemRedactionPolicy>(
  CROCO_PROBLEM_CODE_REGISTRY.problems.map((problem) => [
    problem.code,
    problem.recovery.redactionPolicy,
  ]),
);

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

export function createHttpProblemDetails(problem: Problem, instance: string): ProblemDetails {
  const redactionPolicy = resolveProblemRedactionPolicy(problem);
  const detail = createProblemDetail(problem.detail, redactionPolicy);

  return {
    type: problem.type,
    title: problem.title,
    status: ProblemCategoryMapper.toHttpStatus(problem.category),
    code: problem.code,
    instance,
    ...(detail !== undefined ? { detail } : {}),
    ...createPublicProblemExtensions(problem.extensions ?? {}, redactionPolicy),
  };
}

export function redactHttpProblemDetailsBody(
  body: Record<string, unknown>,
  options: {
    readonly instance: string;
    readonly sourceProblem?: Problem;
  },
): ProblemDetails | undefined {
  if (!isProblemDetailsBody(body)) {
    return undefined;
  }

  const redactionPolicy = resolveProblemDetailsRedactionPolicy(body, options.sourceProblem);
  const detail = createProblemDetail(body.detail, redactionPolicy);

  return {
    type: body.type,
    title: body.title,
    status: body.status,
    code: body.code,
    instance: options.instance,
    ...(detail !== undefined ? { detail } : {}),
    ...createPublicProblemExtensions(extractProblemDetailsExtensions(body), redactionPolicy),
  };
}

function resolveProblemRedactionPolicy(problem: Problem): ProblemRedactionPolicy {
  return (
    PROBLEM_REDACTION_POLICIES.get(problem.code) ??
    getProblemRecoveryMetadata(problem.category).redactionPolicy
  );
}

function resolveProblemDetailsRedactionPolicy(
  body: ProblemDetails,
  sourceProblem: Problem | undefined,
): ProblemRedactionPolicy {
  if (sourceProblem?.code === body.code) {
    return resolveProblemRedactionPolicy(sourceProblem);
  }

  return (
    PROBLEM_REDACTION_POLICIES.get(body.code) ??
    getProblemRecoveryMetadata(toFallbackCategory(body.status, sourceProblem)).redactionPolicy
  );
}

function createProblemDetail(
  detail: unknown,
  redactionPolicy: ProblemRedactionPolicy,
): string | undefined {
  if (redactionPolicy === "operator-only") {
    return OPERATOR_ONLY_DETAIL;
  }

  return typeof detail === "string" ? detail : undefined;
}

function createPublicProblemExtensions(
  extensions: Record<string, unknown>,
  redactionPolicy: ProblemRedactionPolicy,
): Record<string, unknown> {
  if (redactionPolicy === "operator-only") {
    return {};
  }

  return Object.entries(extensions).reduce(
    (acc, [key, value]) => {
      if (!RESERVED_PROBLEM_EXTENSION_FIELDS.has(key) && PUBLIC_PROBLEM_EXTENSION_FIELDS.has(key)) {
        acc[key] = value;
      }

      return acc;
    },
    {} as Record<string, unknown>,
  );
}

function extractProblemDetailsExtensions(body: ProblemDetails): Record<string, unknown> {
  return Object.entries(body).reduce(
    (acc, [key, value]) => {
      if (!RESERVED_PROBLEM_EXTENSION_FIELDS.has(key)) {
        acc[key] = value;
      }

      return acc;
    },
    Object.create(null) as Record<string, unknown>,
  );
}

function isProblemDetailsBody(body: Record<string, unknown>): body is ProblemDetails {
  return (
    typeof body["type"] === "string" &&
    typeof body["title"] === "string" &&
    typeof body["status"] === "number" &&
    typeof body["code"] === "string"
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
