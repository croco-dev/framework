/**
 * @packageDocumentation
 *
 * @croco/notifications-resend 공개 API
 */

/**
 * Resend 전송 실패와 설정/검증 문제를 표현하는 Problem입니다.
 */
export {
  ResendIdempotencyConflictProblem,
  ResendMissingConfigProblem,
  ResendNotificationProblem,
  ResendRetryableUpstreamProblem,
  ResendTerminalUpstreamProblem,
  ResendValidationProblem,
} from "./libs/problems/ResendNotificationProblem";

/**
 * Resend readiness diagnostics provider입니다.
 */
export { ResendDiagnosticsProvider } from "./libs/ResendDiagnosticsProvider";
export type {
  ResendDiagnosticsOptions,
  ResendReadinessCheckContext,
  ResendReadinessCheckResult,
} from "./libs/ResendDiagnosticsProvider";

/**
 * Resend 전송기 생성에 필요한 설정 타입입니다.
 */
export type { ResendConfig, SafeResendConfigDetails } from "./libs/ResendConfig";

/**
 * Resend를 사용해 이메일 알림을 전송하는 NotificationProvider 구현체입니다.
 */
export { ResendProvider } from "./libs/ResendProvider";
