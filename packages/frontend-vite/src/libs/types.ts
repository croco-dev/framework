import type { Plugin } from 'vite';

export type CrocoViteOptions = {
  /** SSR 활성화 여부 (기본: true) */
  ssr?: boolean;
  /** Cloudflare Workers 타겟 여부 (기본: true) */
  cloudflare?: boolean;
};

export type CrocoViteConfig = {
  /** 생성된 Vite 플러그인 배열 */
  plugins: Plugin[];
};

/** SPA 전용 Vite 설정 옵션 */
export type CrocoSpaOptions = {
  /** 빌드 출력 디렉토리 (기본: 'dist') */
  outDir?: string;
  /** 기본 경로 (기본: '/') */
  base?: string;
  /** 환경 변수 접두사 (기본: ['VITE_']) */
  envPrefix?: string[];
};
