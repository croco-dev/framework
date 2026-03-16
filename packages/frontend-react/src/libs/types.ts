export type CrocoPageContext = {
  /** 현재 페이지 URL */
  urlOriginal: string;
  /** API Worker에서 가져온 데이터 */
  data?: unknown;
  /** 페이지별 메타 정보 */
  title?: string;
  description?: string;
  /** Service Binding 환경 (SSR 전용) */
  env?: Record<string, unknown>;
};

export type CrocoDataFn<T = unknown> = (pageContext: CrocoPageContext) => Promise<T> | T;
