import { compareStrings } from "../../../tooling/compareStrings.mjs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ContractGraph, ContractGraphRoute } from "@croco/protocols-core";

export type IntentMapVersion = "croco.intent-map.v1";
export type IntentMapFileRole =
  | "http.controller"
  | "di.provider"
  | "event.handler"
  | "domain.event";
export type IntentMapPublicSymbolKind =
  | "class"
  | "function"
  | "const"
  | "let"
  | "var"
  | "type"
  | "interface"
  | "enum"
  | "re-export";
export type IntentMapGeneratedArtifactKind =
  | "intent-map"
  | "framework-manifest"
  | "route-registration-table"
  | "routes-module";
export type IntentMapRelationshipKind =
  | "controller.exposes-route"
  | "event-handler.handles-event"
  | "component.depends-on";

export type IntentMapSourceLocation = {
  readonly path: string;
  readonly line: number;
  readonly column: number;
};

export type IntentMapPublicSymbol = {
  readonly name: string;
  readonly kind: IntentMapPublicSymbolKind;
  readonly location: IntentMapSourceLocation;
};

export type IntentMapFile = {
  readonly path: string;
  readonly roles: readonly IntentMapFileRole[];
  readonly publicSymbols: readonly IntentMapPublicSymbol[];
  readonly description: string;
};

export type IntentMapController = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly routeIds: readonly string[];
  readonly source?: IntentMapSourceLocation;
  readonly description: string;
};

export type IntentMapRoute = {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly controllerId: string;
  readonly handlerName: string;
  readonly source?: IntentMapSourceLocation;
  readonly description: string;
};

export type IntentMapProvider = {
  readonly id: string;
  readonly name: string;
  readonly scope: "singleton" | "request" | "transient" | "unknown";
  readonly source: IntentMapSourceLocation;
  readonly dependencies: readonly string[];
  readonly description: string;
};

export type IntentMapEventHandler = {
  readonly id: string;
  readonly name: string;
  readonly eventName: string;
  readonly eventClassName: string;
  readonly source: IntentMapSourceLocation;
  readonly description: string;
};

export type IntentMapGeneratedArtifact = {
  readonly kind: IntentMapGeneratedArtifactKind;
  readonly path: string;
  readonly gitIgnored: boolean;
  readonly gitIgnoreRule?: string;
  readonly description: string;
};

export type IntentMapEntityRef = {
  readonly kind: "controller" | "route" | "provider" | "event-handler" | "event";
  readonly id: string;
};

export type IntentMapRelationship = {
  readonly kind: IntentMapRelationshipKind;
  readonly from: IntentMapEntityRef;
  readonly to: IntentMapEntityRef;
  readonly description: string;
};

export type IntentMapSensitiveDataPolicy = {
  readonly included: readonly string[];
  readonly excluded: readonly string[];
};

export type ProjectIntentMap = {
  readonly version: IntentMapVersion;
  readonly summary: {
    readonly files: number;
    readonly controllers: number;
    readonly routes: number;
    readonly providers: number;
    readonly eventHandlers: number;
    readonly publicSymbols: number;
  };
  readonly generatedArtifacts: readonly IntentMapGeneratedArtifact[];
  readonly files: readonly IntentMapFile[];
  readonly controllers: readonly IntentMapController[];
  readonly routes: readonly IntentMapRoute[];
  readonly providers: readonly IntentMapProvider[];
  readonly eventHandlers: readonly IntentMapEventHandler[];
  readonly relationships: readonly IntentMapRelationship[];
  readonly sensitiveDataPolicy: IntentMapSensitiveDataPolicy;
};

export type CreateProjectIntentMapOptions = {
  readonly projectRoot: string;
  readonly sourcePaths: readonly string[];
  readonly contractGraph?: ContractGraph;
  readonly routeRegistrationTable?: IntentMapRouteRegistrationTable;
  readonly generatedArtifacts?: readonly IntentMapGeneratedArtifact[];
};

type RelativeImportTarget = {
  readonly originalName: string;
  readonly path: string;
  readonly isDefault: boolean;
};

type SourceFileIntent = {
  readonly path: string;
  readonly filePath: string;
  readonly content: string;
  readonly lineStarts: readonly number[];
  readonly publicSymbols: readonly IntentMapPublicSymbol[];
  readonly classes: readonly SourceClassIntent[];
  readonly imports: ReadonlyMap<string, RelativeImportTarget>;
};

type SourceClassIntent = {
  readonly name: string;
  readonly decorators: string;
  readonly source: IntentMapSourceLocation;
  readonly roles: readonly IntentMapFileRole[];
  readonly componentScope: IntentMapProvider["scope"];
  readonly eventHandler?: {
    readonly eventName: string;
    readonly eventClassName: string;
  };
  readonly dependencies: readonly string[];
  readonly imports: ReadonlyMap<string, RelativeImportTarget>;
};

type IntentMapRouteRegistrationEntry = {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly contractPath?: string;
  readonly controllerName: string;
  readonly controllerPath: string;
  readonly handlerName: string;
};

type IntentMapRouteRegistrationTable = {
  readonly entries: readonly IntentMapRouteRegistrationEntry[];
};

const INTENT_MAP_VERSION: IntentMapVersion = "croco.intent-map.v1";
const DEFAULT_GENERATED_ARTIFACTS: readonly Omit<
  IntentMapGeneratedArtifact,
  "gitIgnored" | "gitIgnoreRule"
>[] = [
  {
    kind: "framework-manifest",
    path: ".croco/build/framework-manifest.json",
    description:
      "Typed framework manifest generated from Croco source, route, provider, and event metadata.",
  },
  {
    kind: "intent-map",
    path: ".croco/build/intent-map.json",
    description: "LLM-readable project intent map generated from source and contract metadata.",
  },
  {
    kind: "route-registration-table",
    path: ".croco/build/route-registration-table.json",
    description: "Explicit HTTP route registration table consumed by generated route modules.",
  },
  {
    kind: "routes-module",
    path: ".croco/build/routes.mjs",
    description: "Generated route registration module for build-time HTTP controller wiring.",
  },
];
const COMPONENT_SCOPES = new Set(["singleton", "request", "transient"]);
const PRIMITIVE_DEPENDENCIES = new Set([
  "Array",
  "Boolean",
  "Date",
  "Map",
  "Number",
  "Object",
  "Promise",
  "Record",
  "Set",
  "String",
  "unknown",
  "void",
]);

export function createProjectIntentMap(options: CreateProjectIntentMapOptions): ProjectIntentMap {
  const sourceFiles = readSourceFiles(options.projectRoot, options.sourcePaths);
  const classByName = new Map(
    sourceFiles
      .flatMap((sourceFile) => sourceFile.classes)
      .map((sourceClass) => [sourceClass.name, sourceClass]),
  );
  const controllers = createControllers(
    options.contractGraph,
    options.routeRegistrationTable,
    classByName,
  );
  const routes = createRoutes(options.contractGraph, options.routeRegistrationTable, classByName);
  const { providers, dependencyEdges } = createProviders(sourceFiles);
  const eventHandlers = createEventHandlers(sourceFiles);
  const relationships = createRelationships(routes, providers, eventHandlers, dependencyEdges);
  const files = sourceFiles.map(createIntentFile);
  const publicSymbolCount = files.reduce((sum, file) => sum + file.publicSymbols.length, 0);

  return {
    version: INTENT_MAP_VERSION,
    summary: {
      files: files.length,
      controllers: controllers.length,
      routes: routes.length,
      providers: providers.length,
      eventHandlers: eventHandlers.length,
      publicSymbols: publicSymbolCount,
    },
    generatedArtifacts: [
      ...(options.generatedArtifacts ?? createDefaultGeneratedArtifacts(options.projectRoot)),
    ].sort(compareGeneratedArtifacts),
    files,
    controllers,
    routes,
    providers,
    eventHandlers,
    relationships,
    sensitiveDataPolicy: {
      included: [
        "exported symbol names",
        "class roles inferred from Croco decorators",
        "route method/path metadata",
        "event handler event names",
        "constructor dependency type names",
      ],
      excluded: [
        "environment variable values",
        "initializer values",
        "function bodies",
        "runtime request or tenant data",
        "string literals outside Croco structural decorator metadata",
      ],
    },
  };
}

export function createDefaultGeneratedArtifacts(projectRoot: string): IntentMapGeneratedArtifact[] {
  return DEFAULT_GENERATED_ARTIFACTS.map((artifact) => {
    const gitIgnoreRule = findGitIgnoreRule(projectRoot, artifact.path);

    return {
      ...artifact,
      gitIgnored: gitIgnoreRule !== undefined,
      ...(gitIgnoreRule ? { gitIgnoreRule } : {}),
    };
  });
}

function readSourceFiles(projectRoot: string, sourcePaths: readonly string[]): SourceFileIntent[] {
  const seen = new Set<string>();
  const sourceFiles: SourceFileIntent[] = [];

  for (const sourcePath of sourcePaths) {
    const filePath = toFilePath(projectRoot, sourcePath);

    if (seen.has(filePath)) {
      continue;
    }

    if (!existsSync(filePath)) {
      throw new IntentMapSourcePathError(sourcePath);
    }

    seen.add(filePath);
    const content = readFileSync(filePath, "utf-8");
    const lineStarts = getLineStarts(content);
    const stablePath = toStablePath(path.relative(projectRoot, filePath));

    sourceFiles.push({
      path: stablePath,
      filePath,
      content,
      lineStarts,
      publicSymbols: extractPublicSymbols(content, lineStarts, stablePath),
      classes: extractClasses(content, lineStarts, stablePath),
      imports: extractRelativeImports(content, stablePath),
    });
  }

  return sourceFiles.sort((left, right) => compareStrings(left.path, right.path));
}

function createControllers(
  contractGraph: ContractGraph | undefined,
  routeRegistrationTable: IntentMapRouteRegistrationTable | undefined,
  classByName: ReadonlyMap<string, SourceClassIntent>,
): IntentMapController[] {
  if (contractGraph) {
    return [...contractGraph.controllers]
      .map((controller) => ({
        id: controller.name,
        name: controller.name,
        path: controller.path,
        routeIds: [...controller.routeIds].sort(compareStrings),
        ...(classByName.get(controller.name)?.source
          ? { source: classByName.get(controller.name)?.source }
          : {}),
        description: `HTTP controller exposing ${controller.routeIds.length} generated route(s).`,
      }))
      .sort((left, right) => compareStrings(left.id, right.id));
  }

  if (!routeRegistrationTable) {
    return [];
  }

  const routeIdsByController = new Map<string, string[]>();
  const pathByController = new Map<string, string>();

  for (const entry of routeRegistrationTable.entries) {
    routeIdsByController.set(entry.controllerName, [
      ...(routeIdsByController.get(entry.controllerName) ?? []),
      entry.id,
    ]);
    pathByController.set(entry.controllerName, entry.controllerPath);
  }

  return [...routeIdsByController.entries()]
    .map(([controllerName, routeIds]) => ({
      id: controllerName,
      name: controllerName,
      path: pathByController.get(controllerName) ?? "",
      routeIds: routeIds.sort(compareStrings),
      ...(classByName.get(controllerName)?.source
        ? { source: classByName.get(controllerName)?.source }
        : {}),
      description: `HTTP controller exposing ${routeIds.length} generated route(s).`,
    }))
    .sort((left, right) => compareStrings(left.id, right.id));
}

function createRoutes(
  contractGraph: ContractGraph | undefined,
  routeRegistrationTable: IntentMapRouteRegistrationTable | undefined,
  classByName: ReadonlyMap<string, SourceClassIntent>,
): IntentMapRoute[] {
  if (contractGraph) {
    return [...contractGraph.routes]
      .map((route) => createRouteFromContractRoute(route, classByName))
      .sort((left, right) => compareStrings(left.id, right.id));
  }

  return [...(routeRegistrationTable?.entries ?? [])]
    .map((entry) => createRouteFromRegistrationEntry(entry, classByName))
    .sort((left, right) => compareStrings(left.id, right.id));
}

function createRouteFromContractRoute(
  route: ContractGraphRoute,
  classByName: ReadonlyMap<string, SourceClassIntent>,
): IntentMapRoute {
  const controller = classByName.get(route.controllerName);

  return {
    id: route.routeId,
    method: route.httpMethod,
    path: route.path,
    controllerId: route.controllerName,
    handlerName: route.methodName,
    ...(controller?.source ? { source: controller.source } : {}),
    description: `${route.httpMethod} ${route.path} handled by ${route.controllerName}.${route.methodName}.`,
  };
}

function createRouteFromRegistrationEntry(
  entry: IntentMapRouteRegistrationEntry,
  classByName: ReadonlyMap<string, SourceClassIntent>,
): IntentMapRoute {
  const controller = classByName.get(entry.controllerName);

  return {
    id: entry.id,
    method: entry.method,
    path: entry.contractPath ?? entry.path,
    controllerId: entry.controllerName,
    handlerName: entry.handlerName,
    ...(controller?.source ? { source: controller.source } : {}),
    description: `${entry.method} ${entry.contractPath ?? entry.path} handled by ${entry.controllerName}.${entry.handlerName}.`,
  };
}

function createProviders(sourceFiles: readonly SourceFileIntent[]): {
  readonly providers: IntentMapProvider[];
  readonly dependencyEdges: ReadonlyMap<string, readonly string[]>;
} {
  const nameCounts = new Map<string, number>();
  const providerClasses: SourceClassIntent[] = [];

  for (const sourceFile of sourceFiles) {
    for (const sourceClass of sourceFile.classes) {
      if (sourceClass.roles.includes("di.provider")) {
        nameCounts.set(sourceClass.name, (nameCounts.get(sourceClass.name) ?? 0) + 1);
        providerClasses.push(sourceClass);
      }
    }
  }

  const idByClass = createProviderIdMap(providerClasses, nameCounts);
  const dependencyEdges = new Map<string, readonly string[]>();

  const providers = providerClasses.map((sourceClass) => {
    const resolution = resolveProviderDependencies(sourceClass, sourceFiles, idByClass);
    const id = idByClass.get(sourceClass) ?? sourceClass.name;
    dependencyEdges.set(id, resolution.edges);

    return {
      id,
      name: sourceClass.name,
      scope: sourceClass.componentScope,
      source: sourceClass.source,
      dependencies: resolution.dependencies,
      description: `DI component provider with ${sourceClass.componentScope} scope.`,
    };
  });

  return {
    providers: providers.sort((left, right) => compareStrings(left.id, right.id)),
    dependencyEdges,
  };
}

function createProviderIdMap(
  providerClasses: readonly SourceClassIntent[],
  nameCounts: ReadonlyMap<string, number>,
): ReadonlyMap<SourceClassIntent, string> {
  const initialIds = new Map<SourceClassIntent, string>();

  for (const sourceClass of providerClasses) {
    initialIds.set(
      sourceClass,
      createProviderId(sourceClass, nameCounts.get(sourceClass.name) ?? 1),
    );
  }

  const idCounts = new Map<string, number>();

  for (const id of initialIds.values()) {
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  const finalIds = new Map<SourceClassIntent, string>();

  for (const [sourceClass, id] of initialIds) {
    finalIds.set(
      sourceClass,
      (idCounts.get(id) ?? 1) > 1 ? `${sourceClass.source.path}#${sourceClass.name}` : id,
    );
  }

  return finalIds;
}

function createProviderId(sourceClass: SourceClassIntent, nameCount: number): string {
  if (nameCount <= 1) {
    return sourceClass.name;
  }

  return `${withoutExtension(sourceClass.source.path)}#${sourceClass.name}`;
}

function resolveProviderDependencies(
  sourceClass: SourceClassIntent,
  sourceFiles: readonly SourceFileIntent[],
  idByClass: ReadonlyMap<SourceClassIntent, string>,
): { readonly dependencies: string[]; readonly edges: string[] } {
  const providersByName = new Map<string, SourceClassIntent[]>();

  for (const sourceFile of sourceFiles) {
    for (const candidate of sourceFile.classes) {
      if (candidate.roles.includes("di.provider")) {
        providersByName.set(candidate.name, [
          ...(providersByName.get(candidate.name) ?? []),
          candidate,
        ]);
      }
    }
  }

  const dependencies: string[] = [];
  const edges: string[] = [];

  for (const dependency of sourceClass.dependencies) {
    const importResolution = resolveImportedProviderName(
      dependency,
      sourceClass.imports,
      sourceFiles,
    );

    if (importResolution.matched) {
      if (importResolution.provider) {
        const id = idByClass.get(importResolution.provider) ?? importResolution.provider.name;
        dependencies.push(id);
        edges.push(id);
      } else {
        dependencies.push(dependency);
      }

      continue;
    }

    const candidates = providersByName.get(dependency) ?? [];
    const sameFile = candidates.find(
      (candidate) => candidate.source.path === sourceClass.source.path,
    );

    if (sameFile) {
      const id = idByClass.get(sameFile) ?? dependency;
      dependencies.push(id);
      edges.push(id);
      continue;
    }

    if (candidates.length === 1) {
      const candidate = candidates[0];

      if (candidate) {
        const id = idByClass.get(candidate) ?? dependency;
        dependencies.push(id);
        edges.push(id);
      }

      continue;
    }

    dependencies.push(dependency);
  }

  return {
    dependencies: [...new Set(dependencies)].sort(compareStrings),
    edges: [...new Set(edges)].sort(compareStrings),
  };
}

type ImportResolution =
  | { readonly matched: false }
  | { readonly matched: true; readonly provider: SourceClassIntent | undefined };

function resolveImportedProviderName(
  dependency: string,
  imports: ReadonlyMap<string, RelativeImportTarget>,
  sourceFiles: readonly SourceFileIntent[],
): ImportResolution {
  const imported = imports.get(dependency);

  if (!imported) {
    return { matched: false };
  }

  for (const candidatePath of expandImportTarget(imported.path)) {
    for (const sourceFile of sourceFiles) {
      if (sourceFile.path !== candidatePath) {
        continue;
      }

      if (imported.isDefault) {
        const defaultProvider = sourceFile.classes.find(
          (candidate) =>
            candidate.roles.includes("di.provider") &&
            isDefaultExportedClass(sourceFile.content, candidate.name),
        );

        return { matched: true, provider: defaultProvider };
      }

      const provider = sourceFile.classes.find(
        (candidate) =>
          candidate.roles.includes("di.provider") && candidate.name === imported.originalName,
      );

      return { matched: true, provider };
    }
  }

  return { matched: false };
}

function expandImportTarget(importedPath: string): string[] {
  if (/\.(?:c|m)?tsx?$/.test(importedPath)) {
    return [importedPath];
  }

  return [
    `${importedPath}.ts`,
    `${importedPath}.tsx`,
    `${importedPath}.mts`,
    `${importedPath}.cts`,
    `${importedPath}.mjs`,
    `${importedPath}.cjs`,
    `${importedPath}.js`,
    `${importedPath}.jsx`,
    `${importedPath}/index.ts`,
    `${importedPath}/index.tsx`,
    `${importedPath}/index.mts`,
    `${importedPath}/index.cts`,
    `${importedPath}/index.mjs`,
    `${importedPath}/index.cjs`,
    `${importedPath}/index.js`,
  ];
}

function extractRelativeImports(
  content: string,
  importerPath: string,
): Map<string, RelativeImportTarget> {
  const imports = new Map<string, RelativeImportTarget>();
  const importPattern = /\bimport\s+(?:type\s+)?([^;]*?)\bfrom\s*["']([^"']+)["']/g;

  for (const match of content.matchAll(importPattern)) {
    const specifier = match[2];

    if (!specifier || !specifier.startsWith(".")) {
      continue;
    }

    const names = extractImportedNames(match[1] ?? "");
    const targetPath = resolveRelativeImport(importerPath, specifier);

    for (const name of names) {
      imports.set(name.localName, {
        originalName: name.originalName,
        path: targetPath,
        isDefault: name.isDefault,
      });
    }
  }

  return imports;
}

type ImportedName = {
  readonly localName: string;
  readonly originalName: string;
  readonly isDefault: boolean;
};

function extractImportedNames(clause: string): ImportedName[] {
  const names = new Map<string, ImportedName>();
  const withoutTypes = clause.replace(/\btype\s+/g, "").trim();
  const namespaceMatch = withoutTypes.match(/\*\s*as\s+([A-Za-z_$][\w$]*)/);

  if (namespaceMatch?.[1]) {
    names.set(namespaceMatch[1], {
      localName: namespaceMatch[1],
      originalName: namespaceMatch[1],
      isDefault: false,
    });
  }

  const defaultMatch = withoutTypes.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);

  if (defaultMatch?.[1]) {
    names.set(defaultMatch[1], {
      localName: defaultMatch[1],
      originalName: defaultMatch[1],
      isDefault: true,
    });
  }

  const namedMatch = withoutTypes.match(/\{([^}]*)\}/);

  if (namedMatch?.[1]) {
    for (const part of namedMatch[1].split(",")) {
      const trimmed = part.trim().replace(/^type\s+/, "");

      if (!trimmed) {
        continue;
      }

      const [original, alias] = trimmed.split(/\s+as\s+/).map((value) => value.trim());
      const localName = alias || original;

      if (original && localName && /^[A-Za-z_$][\w$]*$/.test(localName)) {
        names.set(localName, { localName, originalName: original, isDefault: false });
      }
    }
  }

  return [...names.values()];
}

function resolveRelativeImport(importerPath: string, specifier: string): string {
  const importerDir = importerPath.includes("/")
    ? importerPath.slice(0, importerPath.lastIndexOf("/"))
    : "";
  const segments = [...(importerDir ? importerDir.split("/") : []), ...specifier.split("/")];
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === "" || segment === ".") {
      continue;
    }

    if (segment === "..") {
      resolved.pop();
      continue;
    }

    resolved.push(segment);
  }

  const joined = resolved.join("/");

  return stripJsExtension(joined);
}

function stripJsExtension(resolvedPath: string): string {
  return resolvedPath.replace(/\.[cm]?jsx?$/, "");
}

function isDefaultExportedClass(content: string, className: string): boolean {
  const directDefault = new RegExp(
    `export\\s+default\\s+(?:abstract\\s+)?class\\s+${className}\\b`,
  );

  if (directDefault.test(content)) {
    return true;
  }

  const namedClass = new RegExp(`(?:\\bexport\\s+)?(?:abstract\\s+)?class\\s+${className}\\b`);

  if (!namedClass.test(content)) {
    return false;
  }

  return new RegExp(`export\\s+default\\s+${className}\\b`).test(content);
}

function withoutExtension(sourcePath: string): string {
  return sourcePath.replace(/\.(?:c|m)?tsx?$/, "");
}

function createEventHandlers(sourceFiles: readonly SourceFileIntent[]): IntentMapEventHandler[] {
  const nameCounts = new Map<string, number>();

  for (const sourceFile of sourceFiles) {
    for (const sourceClass of sourceFile.classes) {
      if (sourceClass.eventHandler) {
        nameCounts.set(sourceClass.name, (nameCounts.get(sourceClass.name) ?? 0) + 1);
      }
    }
  }

  return sourceFiles
    .flatMap((sourceFile) =>
      sourceFile.classes.flatMap((sourceClass) => {
        if (!sourceClass.eventHandler) {
          return [];
        }

        const id =
          (nameCounts.get(sourceClass.name) ?? 1) > 1
            ? `${withoutExtension(sourceClass.source.path)}#${sourceClass.name}`
            : sourceClass.name;

        return [
          {
            id,
            name: sourceClass.name,
            eventName: sourceClass.eventHandler.eventName,
            eventClassName: sourceClass.eventHandler.eventClassName,
            source: sourceClass.source,
            description: `Event handler subscribed to ${sourceClass.eventHandler.eventName}.`,
          },
        ];
      }),
    )
    .sort((left, right) => compareStrings(left.id, right.id));
}

function createRelationships(
  routes: readonly IntentMapRoute[],
  providers: readonly IntentMapProvider[],
  eventHandlers: readonly IntentMapEventHandler[],
  dependencyEdges: ReadonlyMap<string, readonly string[]>,
): IntentMapRelationship[] {
  const providerIds = new Set(providers.map((provider) => provider.id));
  const routeRelationships = routes.map((route) => ({
    kind: "controller.exposes-route" as const,
    from: { kind: "controller" as const, id: route.controllerId },
    to: { kind: "route" as const, id: route.id },
    description: `${route.controllerId} exposes ${route.method} ${route.path}.`,
  }));
  const eventRelationships = eventHandlers.map((handler) => ({
    kind: "event-handler.handles-event" as const,
    from: { kind: "event-handler" as const, id: handler.id },
    to: { kind: "event" as const, id: handler.eventName },
    description: `${handler.id} handles ${handler.eventName}.`,
  }));
  const dependencyRelationships = providers.flatMap((provider) =>
    (dependencyEdges.get(provider.id) ?? [])
      .filter((dependency) => providerIds.has(dependency))
      .map((dependency) => ({
        kind: "component.depends-on" as const,
        from: { kind: "provider" as const, id: provider.id },
        to: { kind: "provider" as const, id: dependency },
        description: `${provider.id} depends on provider ${dependency}.`,
      })),
  );

  return [...routeRelationships, ...eventRelationships, ...dependencyRelationships].sort(
    (left, right) =>
      compareStrings(left.kind, right.kind) ||
      compareStrings(left.from.id, right.from.id) ||
      compareStrings(left.to.id, right.to.id),
  );
}

function createIntentFile(sourceFile: SourceFileIntent): IntentMapFile {
  const roles = [...new Set(sourceFile.classes.flatMap((sourceClass) => sourceClass.roles))].sort(
    compareStrings,
  );
  const roleDescription = roles.length > 0 ? roles.join(", ") : "source module";

  return {
    path: sourceFile.path,
    roles,
    publicSymbols: [...sourceFile.publicSymbols].sort(comparePublicSymbols),
    description: `${sourceFile.path} defines ${roleDescription}.`,
  };
}

function extractPublicSymbols(
  content: string,
  lineStarts: readonly number[],
  filePath: string,
): IntentMapPublicSymbol[] {
  const symbols: IntentMapPublicSymbol[] = [];
  const declarationPattern = new RegExp(
    [
      "\\bexport\\s+(?:declare\\s+)?(?:default\\s+)?(?:(?:abstract|async)\\s+)?",
      "(class|interface|type|enum|function|const|let|var)\\s+([A-Za-z_$][\\w$]*)",
    ].join(""),
    "g",
  );
  const namedExportPattern = /\bexport\s+(type\s+)?\{([^}]+)\}/g;

  for (const match of content.matchAll(declarationPattern)) {
    const kind = match[1];
    const name = match[2];

    if (!isPublicSymbolKind(kind) || !name) {
      continue;
    }

    symbols.push({
      name,
      kind,
      location: toLocation(filePath, lineStarts, match.index ?? 0),
    });
  }

  for (const match of content.matchAll(namedExportPattern)) {
    const exportedNames = (match[2] ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    for (const exportedName of exportedNames) {
      const name = getNamedExportName(exportedName);

      if (!name) {
        continue;
      }

      symbols.push({
        name,
        kind: "re-export",
        location: toLocation(filePath, lineStarts, match.index ?? 0),
      });
    }
  }

  return dedupePublicSymbols(symbols);
}

function extractClasses(
  content: string,
  lineStarts: readonly number[],
  filePath: string,
): SourceClassIntent[] {
  const classes: SourceClassIntent[] = [];
  const classPattern =
    /((?:\s*@[\s\S]*?)?)(?:\bexport\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)[^{]*\{/g;

  for (const match of content.matchAll(classPattern)) {
    const name = match[2];

    if (!name) {
      continue;
    }

    const decorators = match[1] ?? "";
    const classOffset = (match.index ?? 0) + match[0].lastIndexOf("class");
    const body = getClassBody(content, (match.index ?? 0) + match[0].length - 1);

    classes.push({
      name,
      decorators,
      source: toLocation(filePath, lineStarts, classOffset),
      roles: getClassRoles(decorators),
      componentScope: getComponentScope(decorators),
      eventHandler: getEventHandlerMetadata(decorators),
      dependencies: extractConstructorDependencies(body),
      imports: extractRelativeImports(content, toLocation(filePath, lineStarts, classOffset).path),
    });
  }

  return classes.sort((left, right) => compareStrings(left.name, right.name));
}

function getClassRoles(decorators: string): IntentMapFileRole[] {
  const roles: IntentMapFileRole[] = [];

  if (/@Controller\b/.test(decorators)) {
    roles.push("http.controller");
  }

  if (/@Component\b/.test(decorators)) {
    roles.push("di.provider");
  }

  if (/@RegisterEventHandler\b/.test(decorators)) {
    roles.push("event.handler");
  }

  if (/@RegisterEvent\b/.test(decorators)) {
    roles.push("domain.event");
  }

  return roles.sort(compareStrings);
}

function getComponentScope(decorators: string): IntentMapProvider["scope"] {
  if (!/@Component\b/.test(decorators)) {
    return "unknown";
  }

  const match = decorators.match(/\bscope\s*:\s*["']([^"']+)["']/);
  const scope = match?.[1];

  return scope && COMPONENT_SCOPES.has(scope) ? (scope as IntentMapProvider["scope"]) : "singleton";
}

function getEventHandlerMetadata(
  decorators: string,
): SourceClassIntent["eventHandler"] | undefined {
  const match = decorators.match(/@RegisterEventHandler\s*\(\s*([A-Za-z_$][\w$]*)/);
  const eventClassName = match?.[1];

  if (!eventClassName) {
    return undefined;
  }

  const explicitName = decorators.match(/\beventName\s*:\s*["']([^"']+)["']/)?.[1];

  return {
    eventClassName,
    eventName: explicitName ?? eventClassName,
  };
}

function extractConstructorDependencies(classBody: string): string[] {
  const match = classBody.match(/\bconstructor\s*\(([\s\S]*?)\)\s*\{/);
  const params = match?.[1];

  if (!params) {
    return [];
  }

  const dependencies = params.split(",").flatMap((param) => {
    const typeMatch = param.match(/:\s*([A-Za-z_$][\w$]*)/);
    const dependency = typeMatch?.[1];

    return dependency && !PRIMITIVE_DEPENDENCIES.has(dependency) ? [dependency] : [];
  });

  return [...new Set(dependencies)].sort(compareStrings);
}

function getClassBody(content: string, openingBraceIndex: number): string {
  let depth = 0;

  for (let index = openingBraceIndex; index < content.length; index += 1) {
    const char = content[index];

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char !== "}") {
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return content.slice(openingBraceIndex + 1, index);
    }
  }

  return content.slice(openingBraceIndex + 1);
}

function findGitIgnoreRule(projectRoot: string, artifactPath: string): string | undefined {
  const absoluteArtifactPath = path.resolve(projectRoot, artifactPath);
  let currentDir = path.resolve(projectRoot);

  while (true) {
    const gitignorePath = path.join(currentDir, ".gitignore");

    if (existsSync(gitignorePath)) {
      const normalizedArtifactPath = toStablePath(path.relative(currentDir, absoluteArtifactPath));
      const rule = readGitIgnoreRules(gitignorePath).find((candidate) =>
        matchesGitIgnoreRule(candidate, normalizedArtifactPath),
      );

      if (rule) {
        return rule;
      }
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return undefined;
    }

    currentDir = parentDir;
  }
}

function readGitIgnoreRules(gitignorePath: string): string[] {
  return readFileSync(gitignorePath, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function matchesGitIgnoreRule(rule: string, artifactPath: string): boolean {
  const normalizedRule = toStablePath(rule).replace(/\/$/, "");

  if (normalizedRule === artifactPath) {
    return true;
  }

  if (normalizedRule === "**/.croco/build") {
    return artifactPath.startsWith(".croco/build/") || artifactPath.includes("/.croco/build/");
  }

  return artifactPath.startsWith(`${normalizedRule}/`);
}

function toFilePath(projectRoot: string, sourcePath: string): string {
  if (sourcePath.startsWith("file:")) {
    return fileURLToPath(sourcePath);
  }

  return path.isAbsolute(sourcePath) ? sourcePath : path.resolve(projectRoot, sourcePath);
}

function toLocation(
  filePath: string,
  lineStarts: readonly number[],
  offset: number,
): IntentMapSourceLocation {
  let lineIndex = 0;

  for (let index = 0; index < lineStarts.length; index += 1) {
    if ((lineStarts[index] ?? 0) > offset) {
      break;
    }

    lineIndex = index;
  }

  return {
    path: filePath,
    line: lineIndex + 1,
    column: offset - (lineStarts[lineIndex] ?? 0) + 1,
  };
}

function getLineStarts(content: string): number[] {
  const starts = [0];

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === "\n") {
      starts.push(index + 1);
    }
  }

  return starts;
}

function toStablePath(value: string): string {
  return value.split(path.sep).join("/");
}

function isPublicSymbolKind(value: string | undefined): value is IntentMapPublicSymbolKind {
  return (
    value === "class" ||
    value === "function" ||
    value === "const" ||
    value === "let" ||
    value === "var" ||
    value === "type" ||
    value === "interface" ||
    value === "enum"
  );
}

function getNamedExportName(value: string): string | null {
  const withoutTypePrefix = value.replace(/^type\s+/, "").trim();
  const parts = withoutTypePrefix.split(/\s+as\s+/);
  const candidate = (parts[1] ?? parts[0] ?? "").trim();

  return /^[A-Za-z_$][\w$]*$/.test(candidate) ? candidate : null;
}

function dedupePublicSymbols(symbols: readonly IntentMapPublicSymbol[]): IntentMapPublicSymbol[] {
  const byKey = new Map<string, IntentMapPublicSymbol>();

  for (const symbol of symbols) {
    const key = `${symbol.kind}:${symbol.name}:${symbol.location.path}:${symbol.location.line}`;

    if (!byKey.has(key)) {
      byKey.set(key, symbol);
    }
  }

  return [...byKey.values()].sort(comparePublicSymbols);
}

function comparePublicSymbols(left: IntentMapPublicSymbol, right: IntentMapPublicSymbol): number {
  return (
    compareStrings(left.name, right.name) ||
    compareStrings(left.kind, right.kind) ||
    compareStrings(left.location.path, right.location.path) ||
    left.location.line - right.location.line ||
    left.location.column - right.location.column
  );
}

function compareGeneratedArtifacts(
  left: IntentMapGeneratedArtifact,
  right: IntentMapGeneratedArtifact,
): number {
  return compareStrings(left.kind, right.kind) || compareStrings(left.path, right.path);
}

class IntentMapSourcePathError extends Error {
  readonly code = "intent-map-source-path-not-found";

  constructor(sourcePath: string) {
    super(`Intent map source path does not exist: ${sourcePath}`);
    this.name = "IntentMapSourcePathError";
  }
}
