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
