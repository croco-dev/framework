/**
 * @packageDocumentation
 *
 * @croco/notifications-resend 공개 API
 */

/**
 * Resend 전송 실패를 표현하는 Problem입니다.
 */
export { ResendNotificationProblem } from './libs/problems/ResendNotificationProblem';

/**
 * Resend 전송기 생성에 필요한 설정 타입입니다.
 */
export type { ResendConfig } from './libs/ResendProvider';

/**
 * Resend를 사용해 이메일 알림을 전송하는 NotificationProvider 구현체입니다.
 */
export { ResendProvider } from './libs/ResendProvider';
