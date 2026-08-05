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

/** Worker SSR failure boundary diagnostic codes. */
export const SSR_FAILURE_CODES = {
  ASSET_BINDING: "CROCO_CLOUDFLARE_ASSET_BINDING_FAILED",
  API_BINDING: "CROCO_CLOUDFLARE_API_BINDING_FAILED",
  SSR_RENDER: "CROCO_CLOUDFLARE_SSR_RENDER_FAILED",
} as const;

export type SsrFailureCode = (typeof SSR_FAILURE_CODES)[keyof typeof SSR_FAILURE_CODES];

export type SsrFailureBoundary = "asset-binding" | "api-binding" | "ssr-render";

/** Redacted request context and original failure delivered to an application reporter. */
export type SsrFailureReport = {
  readonly code: SsrFailureCode;
  readonly boundary: SsrFailureBoundary;
  readonly correlationId?: string;
  readonly method: string;
  readonly pathname: string;
  readonly error: unknown;
};

export type SsrFailureReporter = (report: SsrFailureReport) => void | Promise<void>;

/**
 * SSR 핸들러 옵션
 *
 * Cloudflare Workers 환경에서 SSR 동작을 제어합니다.
 */
export type SsrHandlerOptions = {
  /** API 서비스 Worker의 바인딩 이름 (기본값: 'API_WORKER') */
  apiBindingName?: string;
  /** Worker 응답 경로와 분리해 경계 실패를 수집하는 선택적 reporter */
  onFailure?: SsrFailureReporter;
};
