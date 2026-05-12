// @croco/meta-vite — Croco-native Vite SSR/RSC meta-framework
//
// v1 public API:
// - defineRoute: flat code-based route registration
// - createMetaFetchHandler: Fetch-based render handler factory
// - crocoMetaVitePlugin: Vite 6 Environment API plugin shell
// - RuntimeContext: provider-neutral context type
// - CrocoFetchHandler: core fetch handler type
// - createCloudflareHandler, createCloudflareComposedHandler, createLambdaHandler, createLambdaComposedHandler,
//   createNodeHandler,
//   createNodeComposedHandler: provider adapters
// - ISR types: CacheStore integration for TTL-only ISR
// - head(): minimal metadata API helper

export type { ServerActionConfig } from "./libs/actions/serverActions";
// Server actions
export {
  createServerAction,
  createServerActionHandler,
  dispatchServerAction,
} from "./libs/actions/serverActions";
export type { SsgRenderedArtifact, SsgRenderFunction } from "./libs/build/ssgPrerender";
// Build helpers
export { prerenderSsgRoutes, renderRouteToString } from "./libs/build/ssgPrerender";
export { createIsrHandler } from "./libs/isr/createIsrHandler";
export { createIsrMiddleware } from "./libs/isr/isrMiddleware";
// ISR
export type {
  IsrCacheAdapter,
  IsrCacheStore,
  IsrMiddleware,
  IsrMiddlewareOptions,
} from "./libs/isr/types";
// Output contract
export type { MetaDeployTarget, MetaOutputContractOptions } from "./libs/output/outputContract";
export { createMetaOutputContract } from "./libs/output/outputContract";
// Provider adapters
export {
  createCloudflareComposedHandler,
  createCloudflareHandler,
} from "./libs/providers/cloudflare";
export { createLambdaComposedHandler, createLambdaHandler } from "./libs/providers/lambda";
export { createNodeComposedHandler, createNodeHandler } from "./libs/providers/node";
export type { MetaFetchHandlerOptions } from "./libs/render/composeHandler";
// Render core
export { createMetaFetchHandler } from "./libs/render/composeHandler";
export { RenderServer } from "./libs/render/renderServer";
export type { CrocoApiHandlerResult, CrocoFetchHandler, RuntimeContext } from "./libs/render/types";
export { defineApiRoute } from "./libs/routes/defineApiRoute";
export { defineRoute } from "./libs/routes/defineRoute";
// Head metadata
export type { HeadMetadata } from "./libs/routes/head";
export { head } from "./libs/routes/head";
export { RouteConflictError, RouteRegistry } from "./libs/routes/routeRegistry";
// Route definitions
export type {
  ApiMethod,
  ApiRouteDefinition,
  ApiRouteIR,
  PageRouteDefinition,
  PageRouteIR,
  RenderMode,
  RenderRouteComponentProps,
  RenderRouteIR,
} from "./libs/routes/types";
// Vite plugin
export { crocoMetaVitePlugin } from "./libs/vite/crocoMetaVitePlugin";
