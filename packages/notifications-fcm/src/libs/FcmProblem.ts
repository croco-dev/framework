import { Problem, ProblemCategory } from "@croco/problems-core";

export type FcmFailureKind =
  | "configuration"
  | "authentication"
  | "validation"
  | "token-invalid"
  | "sender-mismatch"
  | "rate-limit"
  | "timeout"
  | "unavailable"
  | "upstream";

const PROBLEMS = {
  configuration: {
    code: "notifications-fcm/configuration",
    category: ProblemCategory.InternalServerError,
  },
  authentication: {
    code: "notifications-fcm/authentication",
    category: ProblemCategory.InternalServerError,
  },
  validation: {
    code: "notifications-fcm/validation",
    category: ProblemCategory.ValidationError,
  },
  "token-invalid": {
    code: "notifications-fcm/token-invalid",
    category: ProblemCategory.ValidationError,
  },
  "sender-mismatch": {
    code: "notifications-fcm/sender-mismatch",
    category: ProblemCategory.InternalServerError,
  },
  "rate-limit": {
    code: "notifications-fcm/rate-limit",
    category: ProblemCategory.TooManyRequests,
  },
  timeout: {
    code: "notifications-fcm/timeout",
    category: ProblemCategory.InternalServerError,
  },
  unavailable: {
    code: "notifications-fcm/unavailable",
    category: ProblemCategory.InternalServerError,
  },
  upstream: {
    code: "notifications-fcm/upstream",
    category: ProblemCategory.InternalServerError,
  },
} as const satisfies Record<FcmFailureKind, { code: string; category: ProblemCategory }>;

export class FcmProblem extends Problem {
  constructor(kind: FcmFailureKind, operation: "configuration" | "send" | "readiness" = "send") {
    const retryable = kind === "rate-limit" || kind === "timeout" || kind === "unavailable";
    super(PROBLEMS[kind].code, PROBLEMS[kind].category, `FCM ${operation} failed: ${kind}`, {
      extensions: {
        provider: "fcm",
        operation,
        retryable,
        endpointInvalid: kind === "token-invalid",
      },
    });
  }
}

const KINDS: Readonly<Record<string, FcmFailureKind>> = {
  "messaging/registration-token-not-registered": "token-invalid",
  "messaging/invalid-registration-token": "token-invalid",
  "messaging/mismatched-credential": "sender-mismatch",
  "messaging/sender-id-mismatch": "sender-mismatch",
  "messaging/authentication-error": "authentication",
  "messaging/third-party-auth-error": "authentication",
  "messaging/invalid-apns-credentials": "authentication",
  "app/invalid-credential": "configuration",
  "app/invalid-app-options": "configuration",
  "messaging/invalid-argument": "validation",
  "messaging/invalid-recipient": "validation",
  "messaging/invalid-payload": "validation",
  "messaging/invalid-data-payload-key": "validation",
  "messaging/payload-size-limit-exceeded": "validation",
  "messaging/invalid-options": "validation",
  "messaging/invalid-package-name": "validation",
  "messaging/message-rate-exceeded": "rate-limit",
  "messaging/device-message-rate-exceeded": "rate-limit",
  "messaging/topics-message-rate-exceeded": "rate-limit",
  "messaging/quota-exceeded": "rate-limit",
  "messaging/server-unavailable": "unavailable",
  "messaging/internal-error": "unavailable",
  "app/network-error": "unavailable",
  "app/network-timeout": "timeout",
  ETIMEDOUT: "timeout",
  ECONNRESET: "unavailable",
  ECONNREFUSED: "unavailable",
  EAI_AGAIN: "unavailable",
  UND_ERR_CONNECT_TIMEOUT: "timeout",
};

export function normalizeFcmProblem(
  error: unknown,
  operation: "send" | "readiness" = "send",
): FcmProblem {
  const record =
    typeof error === "object" && error !== null ? (error as Record<string, unknown>) : undefined;
  const code = typeof record?.code === "string" ? record.code : "";
  const response =
    typeof record?.httpResponse === "object" && record.httpResponse !== null
      ? (record.httpResponse as Record<string, unknown>)
      : undefined;
  const status = record?.status ?? record?.statusCode ?? response?.status;
  const kind =
    (Object.hasOwn(KINDS, code) ? KINDS[code] : undefined) ??
    (status === 429
      ? "rate-limit"
      : status === 408 || status === 504
        ? "timeout"
        : typeof status === "number" && status >= 500 && status <= 599
          ? "unavailable"
          : status === 401 || status === 403
            ? "authentication"
            : status === 400
              ? "validation"
              : "upstream");
  return new FcmProblem(kind, operation);
}
