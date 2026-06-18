export type { CompiledController } from "./compiler";
export {
  assertRouteRegistrationTable,
  compileRoutes,
  createRouteRegistrationTable,
  generateModule,
  generateModuleFromRouteRegistrationTable,
  generateRouteRegistrationCode,
} from "./compiler";
export type {
  RouteRegistrationCategory,
  RouteRegistrationEntry,
  RouteRegistrationTable,
  RouteRegistrationTableVersion,
} from "./compiler";
export type {
  CreateProjectIntentMapOptions,
  IntentMapController,
  IntentMapEntityRef,
  IntentMapEventHandler,
  IntentMapFile,
  IntentMapFileRole,
  IntentMapGeneratedArtifact,
  IntentMapGeneratedArtifactKind,
  IntentMapProvider,
  IntentMapPublicSymbol,
  IntentMapPublicSymbolKind,
  IntentMapRelationship,
  IntentMapRelationshipKind,
  IntentMapRoute,
  IntentMapSensitiveDataPolicy,
  IntentMapSourceLocation,
  IntentMapVersion,
  ProjectIntentMap,
} from "./intent-map";
export { createDefaultGeneratedArtifacts, createProjectIntentMap } from "./intent-map";
export type { CompiledControllerInfo, CompiledRouteInfo } from "./metadata-reader";
export {
  readControllerConstructors,
  readControllerMetadata,
  readControllersMetadata,
  readControllersMetadataFromConstructors,
} from "./metadata-reader";
