import { type BackoffPolicy, ExponentialBackoff, FixedBackoff } from '@croco/retry-core';

/**
 * QStash 재시도 설정
 */
export type QStashRetryConfig = {
  /** 재시도 횟수 (초기 시도 제외) */
  retries: number;

  /** 재시도 지연 표현식 */
  retryDelay?: string;
};

/**
 * RetryPolicy와 BackoffPolicy를 QStash 재시도 설정으로 변환합니다.
 *
 * @param maxAttempts - 최대 시도 횟수 (초기 시도 포함)
 * @param backoffPolicy - 백오프 정책 (선택사항)
 * @returns QStash retry 설정
 */
export function toQStashRetryOptions(maxAttempts: number, backoffPolicy?: BackoffPolicy): QStashRetryConfig {
  const config: QStashRetryConfig = {
    retries: maxAttempts - 1, // QStash retries는 재시도 횟수 (초기 시도 제외)
  };

  if (backoffPolicy) {
    config.retryDelay = backoffToQStashDelay(backoffPolicy);
  }

  return config;
}

/**
 * BackoffPolicy를 QStash retryDelay 표현식으로 변환합니다.
 *
 * QStash 지원 형식:
 * - 정수: "1000" (1초)
 * - 표현식: "pow(2,retried)*1000" (지수 백오프)
 *
 * @param policy - 백오프 정책
 * @returns QStash retryDelay 표현식
 */
function backoffToQStashDelay(policy: BackoffPolicy): string {
  // ExponentialBackoff 감지
  if (policy instanceof ExponentialBackoff) {
    const baseDelay = (policy as ExponentialBackoff).delay ?? 1000;
    const multiplier = (policy as ExponentialBackoff).multiplier ?? 2;

    // pow(multiplier, retried) * baseDelay
    return `pow(${multiplier},retried)*${baseDelay}`;
  }

  // FixedBackoff 감지
  if (policy instanceof FixedBackoff) {
    const delayMs = (policy as FixedBackoff).delayMs ?? 1000;
    return String(delayMs);
  }

  // NoBackoffPolicy
  return '0';
}

/**
 * QStash Duration 문자열 생성
 *
 * @param ms - 밀리초
 * @returns QStash duration 문자열 (예: "10s", "60m", "2h")
 */
export function toQStashDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}
