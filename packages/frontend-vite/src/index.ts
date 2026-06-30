/**
 * @croco/frontend-vite
 *
 * Croco Presentation Vite integration helpers.
 *
 * 이 패키지는 SPA browser build와 Cloudflare Workers 대상 Vite 설정 helper를
 * 제공합니다. SSR/RSC route runtime은 @croco/meta-vite가 소유합니다.
 *
 * @packageDocumentation
 */

export { createCrocoSpaViteConfig, crocoSpaViteConfig } from "./libs/crocoSpaViteConfig";
export { crocoVitePlugin } from "./libs/crocoVitePlugin";
export { MissingCloudflareVitePluginProblem } from "./libs/problems/MissingCloudflareVitePluginProblem";
export type { CrocoSpaOptions, CrocoViteConfig, CrocoViteOptions } from "./libs/types";
