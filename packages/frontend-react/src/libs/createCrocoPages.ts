import type { RenderMode } from '@croco/meta-vite';

export type CrocoPageOptions = {
  /** SSR 렌더링 여부 (default: true) */
  ssr?: boolean;
  /** 페이지 경로 */
  path?: string;
  /** head 메타데이터 반환 함수 */
  head?: () => { title?: string; description?: string };
  /** ISR revalidate 시간(ms) */
  revalidate?: number;
};

export type CrocoPageConfig = {
  mode: RenderMode;
  head?: () => { title?: string; description?: string };
  revalidateMs?: number;
};

export function createCrocoPageConfig(options?: CrocoPageOptions): CrocoPageConfig {
  return {
    mode: options?.ssr === false ? 'ssg' : 'ssr',
    head: options?.head,
    revalidateMs: options?.revalidate,
  };
}
