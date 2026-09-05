import type { BackoffOptions } from "@croco/retry-core";
import type { SearchOperationOptions } from "@croco/search-core";

/**
 * 테넌트가 없는 시스템 호출에서 물리 인덱스 삭제를 명시적으로 허용하는 옵션입니다.
 */
export type MeilisearchDeleteIndexOptions = SearchOperationOptions & {
  readonly allowGlobalDrop?: boolean;
};

/**
 * 테넌트 토큰 생성 옵션입니다.
 */
export type TenantTokenOptions = {
  apiKeyUid: string;
  expiresIn?: number; // seconds
};

/**
 * Meilisearch 비동기 task 완료 대기 옵션입니다.
 */
export type MeilisearchTaskWaitOptions = {
  enabled?: boolean;
  timeoutMs?: number;
  intervalMs?: number;
};

/**
 * Meilisearch 엔진 초기화 옵션입니다.
 */
export type MeilisearchEngineOptions = {
  host: string;
  apiKey: string;
  tenantTokenOptions?: TenantTokenOptions;
  taskWait?: MeilisearchTaskWaitOptions;
  retryBackoff?: BackoffOptions;
};
