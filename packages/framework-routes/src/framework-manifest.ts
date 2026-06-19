import {
  createProjectIntentMap,
  type CreateProjectIntentMapOptions,
  type IntentMapEntityRef,
  type IntentMapEventHandler,
  type IntentMapFile,
  type IntentMapGeneratedArtifact,
  type IntentMapGeneratedArtifactKind,
  type IntentMapProvider,
  type IntentMapPublicSymbol,
  type IntentMapPublicSymbolKind,
  type IntentMapRelationshipKind,
  type IntentMapRoute,
  type IntentMapSourceLocation,
  type ProjectIntentMap,
} from "./intent-map";

export type FrameworkManifestVersion = "croco.framework-manifest.v1";
export type FrameworkManifestEntityKind =
  | "http.controller"
  | "http.route"
  | "di.provider"
  | "event.handler"
  | "domain.event";
export type FrameworkManifestSourceFileRole =
  | "http.controller"
  | "di.provider"
  | "event.handler"
  | "domain.event";
export type FrameworkManifestGeneratedArtifactKind = IntentMapGeneratedArtifactKind;
export type FrameworkManifestCommitPolicy = "gitignored-generated" | "commit-required";
export type FrameworkManifestDiagnosticSeverity = "error" | "warning";

export type FrameworkManifestSourceLocation = IntentMapSourceLocation;
export type FrameworkManifestPublicSymbolKind = IntentMapPublicSymbolKind;

export type FrameworkManifestExportSymbol = {
  readonly name: string;
  readonly kind: FrameworkManifestPublicSymbolKind;
  readonly source: FrameworkManifestSourceLocation;
};

export type FrameworkManifestEntityVocabularyEntry = {
  readonly kind: FrameworkManifestEntityKind;
  readonly description: string;
  readonly discoveredFrom: readonly string[];
  readonly requiredFields: readonly string[];
};

export type FrameworkManifestSchema = {
  readonly entityVocabulary: readonly FrameworkManifestEntityVocabularyEntry[];
  readonly sourceLocationFields: readonly ["path", "line", "column"];
  readonly consumerApis: readonly string[];
};

export type FrameworkManifestSourceFile = {
  readonly path: string;
  readonly roles: readonly FrameworkManifestSourceFileRole[];
  readonly exports: readonly FrameworkManifestExportSymbol[];
};

type FrameworkManifestEntityBase<TKind extends FrameworkManifestEntityKind> = {
  readonly kind: TKind;
  readonly id: string;
  readonly name: string;
  readonly source?: FrameworkManifestSourceLocation;
  readonly exportSymbol?: FrameworkManifestExportSymbol;
};

export type FrameworkManifestControllerEntity = FrameworkManifestEntityBase<"http.controller"> & {
  readonly path: string;
  readonly routeIds: readonly string[];
};

export type FrameworkManifestRouteEntity = FrameworkManifestEntityBase<"http.route"> & {
  readonly method: string;
  readonly path: string;
  readonly controllerId: string;
  readonly handlerName: string;
};

export type FrameworkManifestProviderEntity = FrameworkManifestEntityBase<"di.provider"> & {
  readonly scope: "singleton" | "request" | "transient" | "unknown";
  readonly dependencies: readonly string[];
};

export type FrameworkManifestEventHandlerEntity = FrameworkManifestEntityBase<"event.handler"> & {
  readonly eventName: string;
  readonly eventClassName: string;
};

export type FrameworkManifestDomainEventEntity = FrameworkManifestEntityBase<"domain.event"> & {
  readonly eventName: string;
};

export type FrameworkManifestEntity =
  | FrameworkManifestControllerEntity
  | FrameworkManifestRouteEntity
  | FrameworkManifestProviderEntity
  | FrameworkManifestEventHandlerEntity
  | FrameworkManifestDomainEventEntity;

export type FrameworkManifestEntityRef = {
  readonly kind: FrameworkManifestEntityKind;
  readonly id: string;
};

export type FrameworkManifestRelationship = {
  readonly kind: IntentMapRelationshipKind;
  readonly from: FrameworkManifestEntityRef;
  readonly to: FrameworkManifestEntityRef;
  readonly description: string;
};

export type FrameworkManifestGeneratedArtifact = {
  readonly kind: FrameworkManifestGeneratedArtifactKind;
  readonly path: string;
  readonly gitIgnored: boolean;
  readonly commitPolicy: FrameworkManifestCommitPolicy;
  readonly gitIgnoreRule?: string;
};

export type FrameworkManifestDiagnostic = {
  readonly code: string;
  readonly severity: FrameworkManifestDiagnosticSeverity;
  readonly message: string;
  readonly entityKind?: FrameworkManifestEntityKind;
  readonly sourcePath?: string;
};

export type FrameworkManifestSummary = {
  readonly sourceFiles: number;
  readonly entities: number;
  readonly controllers: number;
  readonly routes: number;
  readonly providers: number;
  readonly eventHandlers: number;
  readonly domainEvents: number;
  readonly relationships: number;
};

export type FrameworkManifest = {
  readonly version: FrameworkManifestVersion;
  readonly schema: FrameworkManifestSchema;
  readonly summary: FrameworkManifestSummary;
  readonly generatedArtifacts: readonly FrameworkManifestGeneratedArtifact[];
  readonly sourceFiles: readonly FrameworkManifestSourceFile[];
  readonly entities: readonly FrameworkManifestEntity[];
  readonly relationships: readonly FrameworkManifestRelationship[];
  readonly diagnostics: readonly FrameworkManifestDiagnostic[];
};

export type CreateFrameworkManifestOptions = CreateProjectIntentMapOptions & {
  readonly requiredEntityKinds?: readonly FrameworkManifestEntityKind[];
};

export type CreateFrameworkManifestFromIntentMapOptions = {
  readonly requiredEntityKinds?: readonly FrameworkManifestEntityKind[];
};

const FRAMEWORK_MANIFEST_VERSION: FrameworkManifestVersion = "croco.framework-manifest.v1";
const SOURCE_LOCATION_FIELDS = ["path", "line", "column"] as const;
const CONSUMER_APIS = [
  "createFrameworkManifest(options)",
  "createFrameworkManifestFromIntentMap(intentMap)",
  "FrameworkManifest",
] as const;
const ENTITY_VOCABULARY: readonly FrameworkManifestEntityVocabularyEntry[] = [
  {
    kind: "http.controller",
    description: "REST controller class discovered from Croco controller metadata.",
    discoveredFrom: ["@Controller metadata", "contract graph controllers"],
    requiredFields: ["id", "name", "path", "routeIds"],
  },
  {
    kind: "http.route",
    description: "HTTP route exposed by a controller method and contract graph route.",
    discoveredFrom: ["HTTP method decorator metadata", "route registration table"],
    requiredFields: ["id", "method", "path", "controllerId", "handlerName"],
  },
  {
    kind: "di.provider",
    description: "Dependency injection provider discovered from Croco component decorators.",
    discoveredFrom: ["@Component decorator", "constructor dependency type names"],
    requiredFields: ["id", "name", "scope", "dependencies"],
  },
  {
    kind: "event.handler",
    description: "Event handler class discovered from event subscription decorators.",
    discoveredFrom: ["@RegisterEventHandler decorator"],
    requiredFields: ["id", "name", "eventName", "eventClassName"],
  },
  {
    kind: "domain.event",
    description: "Domain event class exported from source modules with Croco event metadata.",
    discoveredFrom: ["@RegisterEvent decorator", "event handler subscriptions"],
    requiredFields: ["id", "name", "eventName"],
  },
];

export class FrameworkManifestDiagnosticError extends Error {
  readonly code = "framework-manifest-diagnostics";
  readonly diagnostics: readonly FrameworkManifestDiagnostic[];

  constructor(diagnostics: readonly FrameworkManifestDiagnostic[]) {
    super(formatFrameworkManifestDiagnostics(diagnostics));
    this.name = "FrameworkManifestDiagnosticError";
    this.diagnostics = diagnostics;
  }
}

export function createFrameworkManifest(
  options: CreateFrameworkManifestOptions,
): FrameworkManifest {
  try {
    return createFrameworkManifestFromIntentMap(createProjectIntentMap(options), options);
  } catch (error) {
    if (error instanceof FrameworkManifestDiagnosticError) {
      throw error;
    }

    if (isIntentMapSourcePathError(error)) {
      throw new FrameworkManifestDiagnosticError([
        {
          code: "framework-manifest-source-path-not-found",
          severity: "error",
          sourcePath: getErrorMessage(error).replace(
            /^Intent map source path does not exist: /,
            "",
          ),
          message: getErrorMessage(error),
        },
      ]);
    }

    throw error;
  }
}

export function createFrameworkManifestFromIntentMap(
  intentMap: ProjectIntentMap,
  options: CreateFrameworkManifestFromIntentMapOptions = {},
): FrameworkManifest {
  const sourceFiles = createSourceFiles(intentMap.files);
  const entities = createEntities(intentMap);
  const relationships = createRelationships(intentMap);
  const diagnostics = validateRequiredEntityKinds(entities, options.requiredEntityKinds ?? []);

  if (diagnostics.length > 0) {
    throw new FrameworkManifestDiagnosticError(diagnostics);
  }

  return {
    version: FRAMEWORK_MANIFEST_VERSION,
    schema: {
      entityVocabulary: ENTITY_VOCABULARY,
      sourceLocationFields: SOURCE_LOCATION_FIELDS,
      consumerApis: CONSUMER_APIS,
    },
    summary: createSummary(sourceFiles, entities, relationships),
    generatedArtifacts: createGeneratedArtifacts(intentMap.generatedArtifacts),
    sourceFiles,
    entities,
    relationships,
    diagnostics: [],
  };
}

export function formatFrameworkManifestDiagnostics(
  diagnostics: readonly FrameworkManifestDiagnostic[],
): string {
  return diagnostics
    .map((diagnostic) => {
      const source = diagnostic.sourcePath ? ` ${diagnostic.sourcePath}` : "";

      return `${diagnostic.severity.toUpperCase()} ${diagnostic.code}${source}: ${diagnostic.message}`;
    })
    .join("\n");
}

function createSourceFiles(files: readonly IntentMapFile[]): FrameworkManifestSourceFile[] {
  return files.map((file) => ({
    path: file.path,
    roles: file.roles.filter(isFrameworkManifestSourceFileRole),
    exports: file.publicSymbols.map(toExportSymbol).sort(compareExportSymbols),
  }));
}

function createEntities(intentMap: ProjectIntentMap): FrameworkManifestEntity[] {
  return [
    ...intentMap.controllers.map((controller) =>
      createControllerEntity(controller, intentMap.files),
    ),
    ...intentMap.routes.map((route) => createRouteEntity(route, intentMap.files)),
    ...intentMap.providers.map((provider) => createProviderEntity(provider, intentMap.files)),
    ...intentMap.eventHandlers.map((handler) => createEventHandlerEntity(handler, intentMap.files)),
    ...createDomainEventEntities(intentMap),
  ].sort(compareEntities);
}

function createControllerEntity(
  controller: ProjectIntentMap["controllers"][number],
  files: readonly IntentMapFile[],
): FrameworkManifestControllerEntity {
  const exportSymbol = findExportSymbol(files, controller.name, controller.source?.path);

  return {
    kind: "http.controller",
    id: controller.id,
    name: controller.name,
    path: controller.path,
    routeIds: controller.routeIds,
    ...(controller.source ? { source: controller.source } : {}),
    ...(exportSymbol ? { exportSymbol } : {}),
  };
}

function createRouteEntity(
  route: IntentMapRoute,
  files: readonly IntentMapFile[],
): FrameworkManifestRouteEntity {
  const exportSymbol = findExportSymbol(files, route.controllerId, route.source?.path);

  return {
    kind: "http.route",
    id: route.id,
    name: route.id,
    method: route.method,
    path: route.path,
    controllerId: route.controllerId,
    handlerName: route.handlerName,
    ...(route.source ? { source: route.source } : {}),
    ...(exportSymbol ? { exportSymbol } : {}),
  };
}

function createProviderEntity(
  provider: IntentMapProvider,
  files: readonly IntentMapFile[],
): FrameworkManifestProviderEntity {
  const exportSymbol = findExportSymbol(files, provider.name, provider.source.path);

  return {
    kind: "di.provider",
    id: provider.id,
    name: provider.name,
    scope: provider.scope,
    dependencies: provider.dependencies,
    source: provider.source,
    ...(exportSymbol ? { exportSymbol } : {}),
  };
}

function createEventHandlerEntity(
  handler: IntentMapEventHandler,
  files: readonly IntentMapFile[],
): FrameworkManifestEventHandlerEntity {
  const exportSymbol = findExportSymbol(files, handler.name, handler.source.path);

  return {
    kind: "event.handler",
    id: handler.id,
    name: handler.name,
    eventName: handler.eventName,
    eventClassName: handler.eventClassName,
    source: handler.source,
    ...(exportSymbol ? { exportSymbol } : {}),
  };
}

function createDomainEventEntities(
  intentMap: ProjectIntentMap,
): FrameworkManifestDomainEventEntity[] {
  const eventNameByClass = new Map(
    intentMap.eventHandlers.map((handler) => [handler.eventClassName, handler.eventName]),
  );
  const eventClassNames = new Set(eventNameByClass.keys());

  return intentMap.files
    .filter((file) => file.roles.includes("domain.event"))
    .flatMap((file) =>
      file.publicSymbols
        .filter((symbol) => symbol.kind === "class" && eventClassNames.has(symbol.name))
        .map((symbol) => {
          const eventName = eventNameByClass.get(symbol.name) ?? symbol.name;

          return {
            kind: "domain.event" as const,
            id: eventName,
            name: symbol.name,
            eventName,
            source: symbol.location,
            exportSymbol: toExportSymbol(symbol),
          };
        }),
    )
    .sort(compareEntities);
}

function createRelationships(intentMap: ProjectIntentMap): FrameworkManifestRelationship[] {
  return intentMap.relationships
    .map((relationship) => ({
      kind: relationship.kind,
      from: toEntityRef(relationship.from),
      to: toEntityRef(relationship.to),
      description: relationship.description,
    }))
    .sort(
      (left, right) =>
        compareStrings(left.kind, right.kind) ||
        compareStrings(left.from.id, right.from.id) ||
        compareStrings(left.to.id, right.to.id),
    );
}

function createGeneratedArtifacts(
  artifacts: readonly IntentMapGeneratedArtifact[],
): FrameworkManifestGeneratedArtifact[] {
  const generatedArtifacts = artifacts.map(toGeneratedArtifact);

  if (!generatedArtifacts.some((artifact) => artifact.kind === "framework-manifest")) {
    const sibling = generatedArtifacts.find((artifact) => artifact.kind === "intent-map");

    generatedArtifacts.push({
      kind: "framework-manifest",
      path: ".croco/build/framework-manifest.json",
      gitIgnored: sibling?.gitIgnored ?? false,
      commitPolicy: sibling?.gitIgnored ? "gitignored-generated" : "commit-required",
      ...(sibling?.gitIgnoreRule ? { gitIgnoreRule: sibling.gitIgnoreRule } : {}),
    });
  }

  return generatedArtifacts.sort(
    (left, right) => compareStrings(left.kind, right.kind) || compareStrings(left.path, right.path),
  );
}

function toGeneratedArtifact(
  artifact: IntentMapGeneratedArtifact,
): FrameworkManifestGeneratedArtifact {
  return {
    kind: artifact.kind,
    path: artifact.path,
    gitIgnored: artifact.gitIgnored,
    commitPolicy: artifact.gitIgnored ? "gitignored-generated" : "commit-required",
    ...(artifact.gitIgnoreRule ? { gitIgnoreRule: artifact.gitIgnoreRule } : {}),
  };
}

function createSummary(
  sourceFiles: readonly FrameworkManifestSourceFile[],
  entities: readonly FrameworkManifestEntity[],
  relationships: readonly FrameworkManifestRelationship[],
): FrameworkManifestSummary {
  return {
    sourceFiles: sourceFiles.length,
    entities: entities.length,
    controllers: countEntities(entities, "http.controller"),
    routes: countEntities(entities, "http.route"),
    providers: countEntities(entities, "di.provider"),
    eventHandlers: countEntities(entities, "event.handler"),
    domainEvents: countEntities(entities, "domain.event"),
    relationships: relationships.length,
  };
}

function validateRequiredEntityKinds(
  entities: readonly FrameworkManifestEntity[],
  requiredEntityKinds: readonly FrameworkManifestEntityKind[],
): FrameworkManifestDiagnostic[] {
  const availableKinds = new Set(entities.map((entity) => entity.kind));

  return [...new Set(requiredEntityKinds)]
    .filter((kind) => !availableKinds.has(kind))
    .map((kind) => ({
      code: "framework-manifest-required-entity-missing",
      severity: "error" as const,
      entityKind: kind,
      message: `Framework manifest requires at least one ${kind} entity, but none were discovered.`,
    }));
}

function toEntityRef(ref: IntentMapEntityRef): FrameworkManifestEntityRef {
  if (ref.kind === "controller") {
    return { kind: "http.controller", id: ref.id };
  }

  if (ref.kind === "route") {
    return { kind: "http.route", id: ref.id };
  }

  if (ref.kind === "provider") {
    return { kind: "di.provider", id: ref.id };
  }

  if (ref.kind === "event-handler") {
    return { kind: "event.handler", id: ref.id };
  }

  return { kind: "domain.event", id: ref.id };
}

function findExportSymbol(
  files: readonly IntentMapFile[],
  name: string,
  sourcePath?: string,
): FrameworkManifestExportSymbol | undefined {
  const candidates = files
    .filter((file) => !sourcePath || file.path === sourcePath)
    .flatMap((file) => file.publicSymbols)
    .filter((symbol) => symbol.name === name);

  const symbol = candidates[0];

  return symbol ? toExportSymbol(symbol) : undefined;
}

function toExportSymbol(symbol: IntentMapPublicSymbol): FrameworkManifestExportSymbol {
  return {
    name: symbol.name,
    kind: symbol.kind,
    source: symbol.location,
  };
}

function countEntities(
  entities: readonly FrameworkManifestEntity[],
  kind: FrameworkManifestEntityKind,
): number {
  return entities.filter((entity) => entity.kind === kind).length;
}

function isFrameworkManifestSourceFileRole(role: string): role is FrameworkManifestSourceFileRole {
  return (
    role === "http.controller" ||
    role === "di.provider" ||
    role === "event.handler" ||
    role === "domain.event"
  );
}

function isIntentMapSourcePathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "intent-map-source-path-not-found"
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compareEntities(left: FrameworkManifestEntity, right: FrameworkManifestEntity): number {
  return compareStrings(left.kind, right.kind) || compareStrings(left.id, right.id);
}

function compareExportSymbols(
  left: FrameworkManifestExportSymbol,
  right: FrameworkManifestExportSymbol,
): number {
  return (
    compareStrings(left.name, right.name) ||
    compareStrings(left.kind, right.kind) ||
    compareStrings(left.source.path, right.source.path) ||
    left.source.line - right.source.line ||
    left.source.column - right.source.column
  );
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}
