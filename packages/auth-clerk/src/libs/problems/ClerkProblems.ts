import type { ProblemOptions } from "@croco/problems-core";
import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * Clerk 웹훅 서명 검증이 실패했을 때 발생하는 Problem입니다.
 */
export class WebhookVerificationProblem extends Problem {
  readonly code = "auth-clerk/webhook-verification-failed";
  readonly category = ProblemCategory.Unauthorized;
  constructor() {
    super(undefined, undefined, "Webhook verification failed");
  }
}

/**
 * Clerk 웹훅 페이로드가 유효하지 않거나 예상한 구조와 다를 때 발생하는 Problem입니다.
 */
export class InvalidWebhookPayloadProblem extends Problem {
  readonly code = "auth-clerk/invalid-webhook-payload";
  readonly category = ProblemCategory.ValidationError;

  constructor(eventType?: string) {
    const message =
      typeof eventType === "string"
        ? `Invalid webhook payload for event '${eventType}'`
        : "Invalid webhook payload";

    super(undefined, undefined, message);
  }
}

/**
 * 동일한 Clerk 웹훅 delivery가 다른 worker에서 처리 중일 때 발생하는 Problem입니다.
 */
export class ClerkWebhookDeliveryInFlightProblem extends Problem {
  readonly code = "auth-clerk/webhook-delivery-in-flight";
  readonly category = ProblemCategory.Conflict;

  constructor(deliveryId: string, eventType: string) {
    super(undefined, undefined, `Clerk webhook delivery '${deliveryId}' is already in-flight`, {
      extensions: {
        deliveryId,
        eventType,
        provider: "clerk",
        retryable: true,
      },
    });
  }
}

/**
 * 동일한 Clerk 웹훅 delivery에 terminal 실패 결과가 저장되어 있을 때 발생하는 Problem입니다.
 */
export class ClerkWebhookDeliveryFailedProblem extends Problem {
  readonly code = "auth-clerk/webhook-delivery-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(deliveryId: string, eventType: string) {
    super(undefined, undefined, `Clerk webhook delivery '${deliveryId}' has a stored failure`, {
      extensions: {
        deliveryId,
        eventType,
        provider: "clerk",
        retryable: false,
      },
    });
  }
}

/**
 * Clerk JWT 토큰 검증이 실패했을 때 발생하는 Problem입니다.
 */
export class ClerkTokenVerificationProblem extends Problem {
  readonly code = "auth-clerk/token-verification-failed";
  readonly category = ProblemCategory.Unauthorized;

  constructor(error?: unknown, operation: ClerkTokenVerificationOperation = "verifyToken") {
    const status = getUpstreamStatus(error);
    const detail = redactSensitiveValue(getErrorMessage(error));

    super(undefined, undefined, detail, {
      extensions: {
        operation,
        provider: "clerk",
        retryable: false,
        ...(status !== undefined ? { upstreamStatus: status } : {}),
      },
    });
  }
}

export type ClerkTokenVerificationOperation = "verifyToken" | "readiness";

/**
 * Clerk 토큰 검증 중 retry 가능한 upstream 오류가 발생했을 때 발생하는 Problem입니다.
 */
export class ClerkTokenVerificationUpstreamProblem extends Problem {
  readonly code = "auth-clerk/token-verification-upstream-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(error: unknown, operation: ClerkTokenVerificationOperation = "verifyToken") {
    const status = getUpstreamStatus(error);
    const retryable = isRetryableClerkAuthError(error);
    const detail = redactSensitiveValue(getErrorMessage(error));

    super(undefined, undefined, `Clerk ${operation} failed: ${detail}`, {
      extensions: {
        operation,
        provider: "clerk",
        retryable,
        ...(status !== undefined ? { upstreamStatus: status } : {}),
      },
    });
  }
}

/**
 * Clerk 토큰 클레임 타입이 잘못되었을 때 발생하는 Problem입니다.
 */
export class ClerkMalformedClaimProblem extends Problem {
  readonly code = "auth-clerk/malformed-claim";
  readonly category = ProblemCategory.Unauthorized;
  constructor(claimName: string) {
    super(undefined, undefined, `Clerk token contained a malformed '${claimName}' claim`);
  }
}

/**
 * Clerk 조직이 이미 다른 tenant에 매핑되어 있을 때 발생하는 Problem입니다.
 */
export class DuplicateTenantMappingProblem extends Problem {
  readonly code = "auth-clerk/duplicate-tenant-mapping";
  readonly category = ProblemCategory.Conflict;
  constructor(externalOrgId: string, existingTenantId: string, nextTenantId: string) {
    super(
      undefined,
      undefined,
      `Clerk org '${externalOrgId}' is already mapped to tenant '${existingTenantId}' and cannot be remapped to '${nextTenantId}'`,
    );
  }
}

/**
 * Clerk 조직 멤버십 응답에 publicUserData가 없을 때 발생하는 Problem입니다.
 */
export class ClerkPublicUserDataMissingProblem extends Problem {
  readonly code = "auth-clerk/public-user-data-missing";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, "Clerk organization membership response is missing publicUserData");
  }
}

/**
 * Clerk 외부 서비스 호출이 실패했을 때 발생하는 Problem입니다.
 */
export class ClerkExternalServiceProblem extends Problem {
  constructor(detail: string, options?: ProblemOptions) {
    super(
      "auth-clerk/external-service-error",
      ProblemCategory.InternalServerError,
      detail,
      options,
    );
  }
}

export function isRetryableClerkAuthError(error: unknown): boolean {
  const status = getUpstreamStatus(error);
  if (status !== undefined) {
    return status === 408 || status === 429 || status >= 500;
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("rate limit") ||
    message.includes("temporarily unavailable")
  );
}

/**
 * Clerk 토큰 검증 오류를 terminal 인증 실패와 retry 가능한 upstream 실패로 분류합니다.
 */
export function createClerkTokenVerificationProblem(
  error: unknown,
  operation: ClerkTokenVerificationOperation = "verifyToken",
): ClerkTokenVerificationProblem | ClerkTokenVerificationUpstreamProblem {
  return isUpstreamClerkAuthError(error)
    ? new ClerkTokenVerificationUpstreamProblem(error, operation)
    : new ClerkTokenVerificationProblem(error, operation);
}

function isUpstreamClerkAuthError(error: unknown): boolean {
  const status = getUpstreamStatus(error);

  return (
    status === 408 ||
    status === 429 ||
    (status !== undefined && status >= 500) ||
    isRetryableClerkAuthError(error)
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  const record = asRecord(error);
  if (typeof record?.message === "string" && record.message) {
    return record.message;
  }

  return "Clerk token verification failed";
}

function getUpstreamStatus(error: unknown): number | undefined {
  const record = asRecord(error);
  const directStatus = normalizeStatus(record?.status ?? record?.statusCode);
  if (directStatus !== undefined) {
    return directStatus;
  }

  const response = asRecord(record?.response);
  return normalizeStatus(response?.status ?? response?.statusCode);
}

function normalizeStatus(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const status = Number(value);
    return Number.isInteger(status) ? status : undefined;
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function redactSensitiveValue(value: string): string {
  return value.replace(
    /(authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|connection[-_]?string|clerk[-_]?secret[-_]?key|dsn)(\s*[:=]\s*)([^,\s;]+)/gi,
    "$1$2[Redacted]",
  );
}
