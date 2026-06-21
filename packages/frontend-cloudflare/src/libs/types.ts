/**
 * Cloudflare Worker 환경 타입
 *
 * API 및 정적 자산에 대한 Fetcher 바인딩을 제공합니다.
 */
export type SsrWorkerEnv = Record<string, unknown> & {
  /** API 서비스 Worker 바인딩 */
  API_WORKER?: Fetcher;
  /** 정적 자산 제공 Worker 바인딩 */
  ASSETS?: Fetcher;
};

/**
 * SSR 핸들러 옵션
 *
 * Cloudflare Workers 환경에서 SSR 동작을 제어합니다.
 */
export type SsrHandlerOptions = {
  /** API 서비스 Worker의 바인딩 이름 (기본값: 'API_WORKER') */
  apiBindingName?: string;
};
