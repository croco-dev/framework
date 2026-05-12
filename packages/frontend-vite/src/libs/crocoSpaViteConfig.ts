import type { Plugin } from "vite";
import type { CrocoSpaOptions } from "./types";

/** SPA 플러그인 배열을 반환합니다. SPA 전용 Vite 플러그인 설정이 추가될 확장 지점입니다. */
export function crocoSpaViteConfig(_options: CrocoSpaOptions = {}): Plugin[] {
  return [];
}

export function createCrocoSpaViteConfig(options: CrocoSpaOptions = {}): {
  plugins: Plugin[];
  build: {
    outDir: string;
  };
  base: string;
  envPrefix: string[];
} {
  const { outDir = "dist", base = "/", envPrefix = ["VITE_"] } = options;

  return {
    plugins: [],
    build: {
      outDir,
    },
    base,
    envPrefix,
  };
}
