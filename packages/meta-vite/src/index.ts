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

export type {
  ServerActionConfig,
  ServerActionFailureResult,
  ServerActionHandlerResult,
  ServerActionContractIR,
  ServerActionOutputContract,
  ServerActionProblemContract,
  ServerActionProblemKind,
  ServerActionResult,
  ServerActionSuccessResult,
  ServerActionValidationFields,
} from "./libs/actions/serverActions";
// Server actions
export {
  createServerActionRegistry,
  createServerAction,
  createServerActionHandler,
  createServerActionSuccess,
  createServerActionSuccessResponse,
  dispatchServerAction,
  resetServerActions,
  ServerActionInvalidContentTypeProblem,
  ServerActionInvalidPathProblem,
  ServerActionMalformedBodyProblem,
  ServerActionNotFoundProblem,
  ServerActionRegistry,
  ServerActionValidationProblem,
  unregisterServerAction,
} from "./libs/actions/serverActions";
export type { SsgRenderedArtifact, SsgRenderFunction } from "./libs/build/ssgPrerender";
// Build helpers
export { prerenderSsgRoutes, renderRouteToString } from "./libs/build/ssgPrerender";
export {
  createMetaViteRouteManifest,
  createMetaViteRouteManifestFromRegistry,
  META_VITE_ROUTE_MANIFEST_COMPONENT_REF_REQUIRED,
  META_VITE_ROUTE_MANIFEST_SCHEMA_VERSION,
  MetaViteRouteManifestError,
  MetaViteUnsupportedCapabilityProblem,
  serializeMetaViteRouteManifest,
  writeMetaViteRouteManifest,
} from "./libs/build/routeManifest";
export type {
  MetaViteApiRouteManifestEntry,
  MetaVitePageRouteManifestEntry,
  MetaViteRouteManifest,
  MetaViteRouteManifestRegistryOptions,
  MetaViteRouteManifestSource,
  MetaViteRouteRegistryManifestSource,
  MetaViteRuntimeCapability,
  MetaViteRuntimeRequirement,
  MetaViteRuntimeRequirementCode,
  MetaViteServerActionManifestEntry,
  MetaViteServerActionRegistryManifestSource,
} from "./libs/build/routeManifest";
export {
  checkMetaViteFrontendActionManifestFile,
  createMetaViteFrontendActionManifest,
  createMetaViteFrontendActionManifestFromRegistry,
  serializeMetaViteFrontendActionManifest,
  writeMetaViteFrontendActionManifest,
} from "./libs/build/frontendActionManifest";
export type {
  MetaViteFrontendActionManifestRegistryOptions,
  MetaViteFrontendActionManifestSource,
  MetaViteServerActionRegistryFrontendActionManifestSource,
} from "./libs/build/frontendActionManifest";
export { createIsrHandler } from "./libs/isr/createIsrHandler";
export { createIsrMiddleware } from "./libs/isr/isrMiddleware";
export {
  createPrivateInput,
  formatPersonalizedInspectEvent,
  hashPersonalizedCacheKey,
  loadPersonalizedFragments,
  renderPersonalizedResponse,
} from "./libs/isr/personalizedFragments";
export type {
  PersonalizedFragmentCacheOptions,
  PersonalizedFragmentInspectEvent,
  PersonalizedFragmentLoader,
  PersonalizedFragmentResult,
  PersonalizedFragmentStore,
  PersonalizedPrivateInput,
  PersonalizedPrivateLoader,
  PersonalizedPublicInput,
  PersonalizedRenderInput,
} from "./libs/isr/personalizedFragments";
export {
  createDurableIsrCacheProfile,
  createLocalIsrCacheProfile,
  evaluateIsrRuntimeSupport,
} from "./libs/isr/runtimeSupport";
// ISR
export type {
  DurableIsrCacheStoreProfileOptions,
  IsrCacheDurability,
  IsrCacheStoreProfile,
  IsrRuntime,
  IsrRuntimeDiagnostic,
  IsrRuntimeDiagnosticCode,
  IsrRuntimeDiagnosticSeverity,
  IsrRuntimeSupportOptions,
  IsrRuntimeSupportReport,
} from "./libs/isr/runtimeSupport";
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
export {
  createDeferredRegionStore,
  DeferredRegionCancelledError,
  DeferredRegionTimeoutError,
  DeferredRegionUnknownError,
} from "./libs/render/deferredRegions";
export type { DeferredRegionReader } from "./libs/render/deferredRegions";
export { RenderServer } from "./libs/render/renderServer";
export {
  applyShellStreamHeaders,
  resolveShellStreamPolicy,
  SHELL_STREAM_DEFAULT_DEADLINE_MS,
  SHELL_STREAM_DEFAULT_MAX_BUFFERED_BYTES,
  SHELL_STREAM_DEFAULT_REGION_TIMEOUT_MS,
  SHELL_STREAM_DELIVERY_HEADER,
  SHELL_STREAM_MAX_BUFFERED_BYTES_CODE,
  SHELL_STREAM_RENDER_ABORTED_CODE,
  SHELL_STREAM_SERVER_TIMING,
  ShellStreamAbortedError,
  ShellStreamMaxBufferedBytesError,
} from "./libs/render/shellStream";
export type {
  ShellStreamDelivery,
  ShellStreamPolicy,
  ShellStreamRequest,
} from "./libs/render/shellStream";
export type { CrocoApiHandlerResult, CrocoFetchHandler, RuntimeContext } from "./libs/render/types";
export type {
  DeferredRegionDefinition,
  DeferredRegionLoader,
  DeferredRegionLoaderInput,
  PageRouteStreamDefinition,
  ShellDecision,
  ShellDecisionInput,
  ShellRenderOptions,
  ShellRuntimeContext,
  ShellRuntimePlatform,
  ShellSettleSummary,
} from "./libs/routes/shell";
export { defineApiRoute } from "./libs/routes/defineApiRoute";
export { defineRoute } from "./libs/routes/defineRoute";
// Head metadata
export type { HeadMetadata } from "./libs/routes/head";
export { head } from "./libs/routes/head";
export {
  RouteConflictError,
  RouteRegistry,
  ShellRouteDefinitionError,
} from "./libs/routes/routeRegistry";
// Route definitions
export type {
  ApiMethod,
  ApiRouteDefinition,
  ApiRouteHandler,
  ApiRouteIR,
  PageRouteDefinition,
  PageRouteIR,
  RenderMode,
  RenderRouteComponentProps,
  RenderRouteIR,
} from "./libs/routes/types";
// Vite plugin
export { crocoMetaVitePlugin } from "./libs/vite/crocoMetaVitePlugin";
