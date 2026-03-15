import { randomUUID } from 'node:crypto';
import { Context } from '@croco/framework-context';

export type PostHogProperties = Record<string, string>;

/**
 * PostHog에서 사용할 distinct ID를 생성합니다.
 * 우선순위:
 * 1. context.userId (명시적으로 전달된 사용자 ID)
 * 2. Context.getCurrentUser().id (현재 로그인한 사용자)
 * 3. Context.getRequestId() (요청 ID가 있으면 anonymous:{requestId})
 * 4. Context.getTenantId() (테넌트 ID가 있으면 tenant:{tenantId})
 * 5. randomUUID() (완전한 익명 사용자)
 */
export function getDistinctId(context?: Record<string, unknown>): string {
  if (context?.userId) return String(context.userId);

  const user = Context.getCurrentUser();
  if (user?.id) return user.id;

  const requestId = Context.getRequestId();
  if (requestId) return `anonymous:${requestId}`;

  const tenantId = Context.getTenantId();
  if (tenantId) return `tenant:${tenantId}`;

  return `anonymous:${randomUUID()}`;
}

/**
 * PostHog 그룹 정보를 추출합니다.
 * 우선순위:
 * 1. context.groups (명시적으로 전달된 그룹 정보 - toStringRecord로 변환)
 * 2. Context.getTenantId() (테넌트 ID가 있으면 { tenant: tenantId })
 */
export function getGroups(context?: Record<string, unknown>): PostHogProperties | undefined {
  const groups = toStringRecord(context?.groups);
  if (groups) return groups;

  const tenantId = Context.getTenantId();
  if (tenantId) {
    return { tenant: tenantId };
  }

  return undefined;
}

/**
 * 객체를 PostHog 속성 형식(Record<string, string>)으로 변환합니다.
 * primitive 타입(string, number, boolean)만 포함하며, 그 외는 필터링합니다.
 */
export function toStringRecord(value: unknown): PostHogProperties | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const result: PostHogProperties = {};

  for (const [key, entryValue] of Object.keys(value).map(
    (key) => [key, (value as Record<string, unknown>)[key]] as const
  )) {
    if (entryValue === undefined || typeof entryValue === 'object' || typeof entryValue === 'function') {
      continue;
    }

    result[key] = String(entryValue);
  }

  if (Object.keys(result).length === 0) {
    return undefined;
  }

  return result;
}
