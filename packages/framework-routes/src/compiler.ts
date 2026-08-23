import {
  buildContractGraph,
  ContractGraphDiagnosticError,
  getContractGraphErrors,
  toRuntimeRoutePath,
  type ContractDiagnostic,
  type ContractGraph,
  type Constructor,
} from "@croco/protocols-core";
import { HttpMethod } from "@croco/protocols-rest";
import { createFrameworkManifestFromIntentMap } from "./framework-manifest";
import type { CompiledRouteInfo } from "./metadata-reader";
import { createProjectIntentMap } from "./intent-map";
import { readControllerModule, readControllersMetadataFromConstructors } from "./metadata-reader";

export type CompiledController = {
  readonly basePath: string;
  readonly className?: string;
  readonly routes: readonly CompiledRouteInfo[];
};

export type RouteRegistrationTableVersion = "croco.route-registration-table.v1";
export type RouteRegistrationCategory = "http.controller";

export type RouteRegistrationEntry = {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  /** Authored contract path. Optional only for compatibility with v1 tables created before this field existed. */
  readonly contractPath?: string;
  readonly controllerName: string;
  readonly controllerPath: string;
  readonly handlerName: string;
};

export type RouteRegistrationTable = {
  readonly version: RouteRegistrationTableVersion;
  readonly category: RouteRegistrationCategory;
  readonly entries: readonly RouteRegistrationEntry[];
};

type CompileRoutesOptions = {
  readonly controllerPaths: readonly string[];
  readonly sourcePaths?: readonly string[];
  readonly outputDir: string;
};

export type GeneratedControllerBinding = {
  readonly controllerName: string;
  readonly importPath: string;
  readonly exportName: string;
};

const ROUTE_REGISTRATION_TABLE_VERSION: RouteRegistrationTableVersion =
  "croco.route-registration-table.v1";
const ROUTE_REGISTRATION_CATEGORY: RouteRegistrationCategory = "http.controller";
type RouteRegistrationAdapterMethods = {
  readonly [Method in HttpMethod]: Lowercase<Method>;
};
const ROUTE_METHOD_ADAPTERS = {
  [HttpMethod.GET]: "get",
  [HttpMethod.POST]: "post",
  [HttpMethod.PUT]: "put",
  [HttpMethod.PATCH]: "patch",
  [HttpMethod.DELETE]: "delete",
  [HttpMethod.OPTIONS]: "options",
  [HttpMethod.HEAD]: "head",
  [HttpMethod.ALL]: "all",
} as const satisfies RouteRegistrationAdapterMethods;
const SUPPORTED_ROUTE_METHODS = new Set<string>(Object.keys(ROUTE_METHOD_ADAPTERS));
const ALL_METHOD_GENERATED_CONTRACT_DIAGNOSTIC_CODE = "contract-route-unsupported-all-method";

function assertRouteRegistrationContractGraphHasNoErrors(contractGraph: ContractGraph): void {
  const allRouteIds = new Set(
    contractGraph.routes
      .filter((route) => route.httpMethod.toUpperCase() === HttpMethod.ALL)
      .map((route) => route.routeId),
  );
  const blockingDiagnostics = getContractGraphErrors(contractGraph).filter(
    (diagnostic) =>
      diagnostic.code !== ALL_METHOD_GENERATED_CONTRACT_DIAGNOSTIC_CODE ||
      diagnostic.routeId === undefined ||
      !allRouteIds.has(diagnostic.routeId),
  );

  if (blockingDiagnostics.length > 0) {
    throw new ContractGraphDiagnosticError(blockingDiagnostics);
  }
}

function joinRoutePath(basePath: string, routePath: string): string {
  const cleanBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const cleanRoute =
    routePath === "" ? "" : routePath.startsWith("/") ? routePath : `/${routePath}`;
  const fullPath = `${cleanBase}${cleanRoute}`.replace(/\/+/g, "/");

  return fullPath.length > 1 && fullPath.endsWith("/") ? fullPath.slice(0, -1) : fullPath || "/";
}

export function createRouteRegistrationTable(
  controllers: readonly CompiledController[],
  contractGraph?: ContractGraph,
): RouteRegistrationTable {
  if (contractGraph) {
    assertRouteRegistrationContractGraphHasNoErrors(contractGraph);
  }

  const table: RouteRegistrationTable = {
    version: ROUTE_REGISTRATION_TABLE_VERSION,
    category: ROUTE_REGISTRATION_CATEGORY,
    entries: controllers.flatMap((controller) =>
      controller.routes.map((route) => {
        const controllerName = controller.className ?? "Controller";
        const contractPath = joinRoutePath(controller.basePath, route.path);

        return {
          id: `${controllerName}.${route.handlerName}`,
          method: route.method.toUpperCase(),
          path: toRuntimeRoutePath(contractPath),
          contractPath,
          controllerName,
          controllerPath: controller.basePath,
          handlerName: route.handlerName,
        };
      }),
    ),
  };

  assertRouteRegistrationTable(table, contractGraph);

  return table;
}

export function assertRouteRegistrationTable(
  table: RouteRegistrationTable,
  contractGraph?: ContractGraph,
): void {
  const diagnostics: ContractDiagnostic[] = [
    ...validateSupportedMethods(table),
    ...validateRuntimePathConsistency(table),
    ...validateDuplicateEndpoints(table),
    ...validateContractGraphCoverage(table, contractGraph),
  ];

  if (diagnostics.length > 0) {
    throw new ContractGraphDiagnosticError(diagnostics);
  }
}

export function generateRouteRegistrationCode(controllers: readonly CompiledController[]): string {
  return generateModuleFromRouteRegistrationTable(createRouteRegistrationTable(controllers));
}

export function generateModuleFromRouteRegistrationTable(
  table: RouteRegistrationTable,
  controllerBindings: readonly GeneratedControllerBinding[] = [],
): string {
  assertRouteRegistrationTable(table);

  const lines: string[] = [];
  const sortedControllerBindings = [...controllerBindings].sort(compareControllerBindings);
  const runtimeEntries = table.entries.map((entry) => ({
    ...entry,
    path: toRuntimeRoutePath(entry.path),
    contractPath: getRouteRegistrationContractPath(entry),
  }));

  lines.push("// Auto-generated by @croco/framework-routes compiler");
  lines.push("// Do not edit manually");
  lines.push("");
  lines.push('import * as frameworkContext from "@croco/framework-context";');
  lines.push("const { Container } = frameworkContext;");
  for (const [index, binding] of sortedControllerBindings.entries()) {
    lines.push(
      `import { ${binding.exportName} as GeneratedController${index} } from ${JSON.stringify(binding.importPath)};`,
    );
  }
  lines.push("");
  lines.push(
    `const routeRegistrationTable = Object.freeze(${JSON.stringify(runtimeEntries, null, 2)});`,
  );
  lines.push("export { routeRegistrationTable };");
  lines.push("");
  lines.push("const generatedControllerBindings = Object.freeze({");
  for (const [index, binding] of sortedControllerBindings.entries()) {
    lines.push(`  ${JSON.stringify(binding.controllerName)}: GeneratedController${index},`);
  }
  lines.push("});");
  lines.push("");
  lines.push("const generatedHandlerBindings = Object.freeze({");
  for (const route of runtimeEntries) {
    lines.push(`  ${JSON.stringify(route.id)}: {`);
    lines.push(`    handlerName: ${JSON.stringify(route.handlerName)},`);
    lines.push("  },");
  }
  lines.push("});");
  lines.push("");
  lines.push("function createGeneratedRouteHandler(route, additionalControllerBindings) {");
  lines.push("  const binding = generatedHandlerBindings[route.id];");
  lines.push(
    "  const controllerType = generatedControllerBindings[route.controllerName] ?? additionalControllerBindings[route.controllerName];",
  );
  lines.push('  if (!binding || typeof controllerType !== "function") {');
  lines.push('    throw new RouteRegistrationTableError(route, "missing-controller-binding");');
  lines.push("  }");
  lines.push("  return (c) => {");
  lines.push("    const controller = Container.get(controllerType);");
  lines.push("    const handler = controller[binding.handlerName];");
  lines.push('    if (typeof handler !== "function") {');
  lines.push('      throw new RouteRegistrationTableError(route, "missing-handler-binding");');
  lines.push("    }");
  lines.push("    return handler.call(controller, c);");
  lines.push("  };");
  lines.push("}");
  lines.push("");
  lines.push("class RouteRegistrationTableError extends Error {");
  lines.push('  constructor(route, reason = "unsupported-method") {');
  lines.push("    super(`Generated route registration failed for ${route.id}: ${reason}`);");
  lines.push('    this.name = "RouteRegistrationTableError";');
  lines.push("    this.code = `route-registration-${reason}`;");
  lines.push("  }");
  lines.push("}");
  lines.push("");
  lines.push("function registerGeneratedRoute(app, route, additionalControllerBindings) {");
  lines.push("  switch (route.method) {");
  for (const [method, adapterMethod] of Object.entries(ROUTE_METHOD_ADAPTERS)) {
    lines.push(`    case ${JSON.stringify(method)}:`);
    lines.push(
      `      app.${adapterMethod}(route.path, createGeneratedRouteHandler(route, additionalControllerBindings));`,
    );
    lines.push("      return;");
  }
  lines.push("    default:");
  lines.push("      throw new RouteRegistrationTableError(route);");
  lines.push("  }");
  lines.push("}");
  lines.push("");
  lines.push(
    "export function registerRoutes(app, additionalControllerBindings = Object.freeze({})) {",
  );
  lines.push("  for (const route of routeRegistrationTable) {");
  lines.push("    registerGeneratedRoute(app, route, additionalControllerBindings);");
  lines.push("  }");
  lines.push("}");

  return lines.join("\n");
}

export function generateModule(controllers: readonly CompiledController[]): string {
  return generateModuleFromRouteRegistrationTable(createRouteRegistrationTable(controllers));
}

export async function compileRoutes(options: CompileRoutesOptions): Promise<void> {
  const controllerConstructors: Constructor[] = [];
  const controllerModules: Array<{
    readonly path: string;
    readonly constructors: readonly Constructor[];
    readonly exportNames: ReadonlyMap<Constructor, string>;
  }> = [];

  for (const controllerPath of options.controllerPaths) {
    const controllerModule = await readControllerModule(controllerPath);
    controllerConstructors.push(...controllerModule.constructors);
    controllerModules.push({
      path: controllerPath,
      constructors: controllerModule.constructors,
      exportNames: controllerModule.exportNames,
    });
  }

  const contractGraph = buildContractGraph(controllerConstructors);
  assertRouteRegistrationContractGraphHasNoErrors(contractGraph);

  const controllers = readControllersMetadataFromConstructors(controllerConstructors);
  const routeRegistrationTable = createRouteRegistrationTable(controllers, contractGraph);
  const intentMap = createProjectIntentMap({
    projectRoot: options.outputDir,
    sourcePaths: await resolveIntentSourcePaths(options),
    contractGraph,
    routeRegistrationTable,
  });
  const frameworkManifest = createFrameworkManifestFromIntentMap(intentMap);

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const outDir = path.join(options.outputDir, ".croco", "build");
  const routesModulePath = path.join(outDir, "routes.mjs");
  const controllerBindings = createGeneratedControllerBindings(controllerModules);

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "route-registration-table.json"),
    `${JSON.stringify(routeRegistrationTable, null, 2)}\n`,
    "utf-8",
  );
  await fs.writeFile(
    path.join(outDir, "framework-manifest.json"),
    `${JSON.stringify(frameworkManifest, null, 2)}\n`,
    "utf-8",
  );
  await fs.writeFile(
    path.join(outDir, "intent-map.json"),
    `${JSON.stringify(intentMap, null, 2)}\n`,
    "utf-8",
  );
  await fs.writeFile(
    routesModulePath,
    generateModuleFromRouteRegistrationTable(routeRegistrationTable, controllerBindings),
    "utf-8",
  );
}

function createGeneratedControllerBindings(
  controllerModules: readonly {
    readonly path: string;
    readonly constructors: readonly Constructor[];
    readonly exportNames: ReadonlyMap<Constructor, string>;
  }[],
): GeneratedControllerBinding[] {
  const bindings: GeneratedControllerBinding[] = [];

  for (const controllerModule of controllerModules) {
    for (const controller of controllerModule.constructors) {
      const exportName = controllerModule.exportNames.get(controller);

      if (exportName === undefined) {
        throw new ContractGraphDiagnosticError([
          {
            code: "route-registration-controller-export-missing",
            severity: "error",
            target: "route",
            controllerName: controller.name,
            message:
              `Generated route module cannot bind controller '${controller.name}' because it is not exported from ` +
              `'${controllerModule.path}'.`,
          },
        ]);
      }

      bindings.push({
        controllerName: controller.name,
        importPath: getGeneratedModuleImportPath(controllerModule.path),
        exportName,
      });
    }
  }

  return bindings;
}

function getGeneratedModuleImportPath(controllerPath: string): string {
  if (!controllerPath.startsWith("file:")) {
    return controllerPath;
  }

  return controllerPath;
}

function compareControllerBindings(
  left: GeneratedControllerBinding,
  right: GeneratedControllerBinding,
): number {
  return (
    compareStrings(left.controllerName, right.controllerName) ||
    compareStrings(left.importPath, right.importPath) ||
    compareStrings(left.exportName, right.exportName)
  );
}

async function resolveIntentSourcePaths(options: CompileRoutesOptions): Promise<string[]> {
  if (options.sourcePaths) {
    return [...options.sourcePaths];
  }

  return uniqueStrings([
    ...options.controllerPaths,
    ...(await discoverProjectSourcePaths(options.outputDir)),
  ]);
}

async function discoverProjectSourcePaths(projectRoot: string): Promise<string[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const sourceRoot = path.join(projectRoot, "src");

  try {
    const sourceRootStat = await fs.stat(sourceRoot);

    if (!sourceRootStat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  return collectSourceFiles(sourceRoot);
}

async function collectSourceFiles(sourceRoot: string): Promise<string[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  const sourcePaths: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(sourceRoot, entry.name);

    if (entry.isDirectory()) {
      if (!isSkippedSourceDirectory(entry.name)) {
        sourcePaths.push(...(await collectSourceFiles(entryPath)));
      }

      continue;
    }

    if (entry.isFile() && isIntentSourceFile(entry.name)) {
      sourcePaths.push(entryPath);
    }
  }

  return sourcePaths.sort(compareStrings);
}

function isSkippedSourceDirectory(name: string): boolean {
  return name === "node_modules" || name === "dist" || name === ".croco" || name === "coverage";
}

function isIntentSourceFile(name: string): boolean {
  return (
    /\.(?:c|m)?tsx?$/.test(name) &&
    !name.endsWith(".d.ts") &&
    !name.endsWith(".spec.ts") &&
    !name.endsWith(".test.ts")
  );
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function validateSupportedMethods(table: RouteRegistrationTable): ContractDiagnostic[] {
  return table.entries
    .filter((entry) => !SUPPORTED_ROUTE_METHODS.has(entry.method))
    .map((entry) =>
      createRouteRegistrationDiagnostic(
        entry,
        "route-registration-unsupported-method",
        `Route registration '${entry.id}' uses unsupported HTTP method '${entry.method}'. ` +
          "Use explicit HTTP method decorators supported by the generated table.",
      ),
    );
}

function validateDuplicateEndpoints(table: RouteRegistrationTable): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const endpoints = new Map<string, RouteRegistrationEntry>();

  for (const entry of table.entries) {
    const endpointKey = `${entry.method} ${toRuntimeRoutePath(entry.path)}`;
    const existingEntry = endpoints.get(endpointKey);

    if (existingEntry) {
      diagnostics.push(
        createRouteRegistrationDiagnostic(
          entry,
          "route-registration-duplicate-endpoint",
          `Route registration '${entry.id}' authored as ${entry.method} ${getRouteRegistrationContractPath(entry)} ` +
            `duplicates route '${existingEntry.id}' authored as ${existingEntry.method} ${getRouteRegistrationContractPath(existingEntry)}.`,
        ),
      );
      continue;
    }

    endpoints.set(endpointKey, entry);
  }

  return diagnostics;
}

function validateRuntimePathConsistency(table: RouteRegistrationTable): ContractDiagnostic[] {
  return table.entries.flatMap((entry) => {
    if (entry.contractPath === undefined) {
      return [];
    }

    if (entry.path === toRuntimeRoutePath(entry.contractPath)) {
      return [];
    }

    return [
      createRouteRegistrationDiagnostic(
        entry,
        "route-registration-runtime-path-mismatch",
        `Route registration '${entry.id}' does not match its authored contract path '${entry.contractPath}'. ` +
          "Regenerate the route registration table from controller metadata.",
      ),
    ];
  });
}

function getRouteRegistrationContractPath(entry: RouteRegistrationEntry): string {
  return entry.contractPath ?? entry.path;
}

function validateContractGraphCoverage(
  table: RouteRegistrationTable,
  contractGraph?: ContractGraph,
): ContractDiagnostic[] {
  if (!contractGraph) {
    return [];
  }

  const diagnostics: ContractDiagnostic[] = [];
  const entriesById = new Map(table.entries.map((entry) => [entry.id, entry]));
  const graphRoutesById = new Map(contractGraph.routes.map((route) => [route.routeId, route]));

  for (const route of contractGraph.routes) {
    if (entriesById.has(route.routeId)) {
      continue;
    }

    diagnostics.push({
      code: "route-registration-missing-route",
      severity: "error",
      target: "route",
      routeId: route.routeId,
      controllerName: route.controllerName,
      methodName: route.methodName,
      path: route.path,
      message: `Generated route registration table is missing contract route '${route.routeId}'.`,
    });
  }

  for (const entry of table.entries) {
    if (graphRoutesById.has(entry.id)) {
      continue;
    }

    diagnostics.push(
      createRouteRegistrationDiagnostic(
        entry,
        "route-registration-orphan-route",
        `Route registration '${entry.id}' is not present in the contract graph.`,
      ),
    );
  }

  return diagnostics;
}

function createRouteRegistrationDiagnostic(
  entry: RouteRegistrationEntry,
  code: string,
  message: string,
): ContractDiagnostic {
  return {
    code,
    severity: "error",
    target: "route",
    routeId: entry.id,
    controllerName: entry.controllerName,
    methodName: entry.handlerName,
    path: getRouteRegistrationContractPath(entry),
    message,
  };
}
