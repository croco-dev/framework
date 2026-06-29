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
};
