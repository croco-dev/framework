#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { argv, exit, stdout } from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";

import { readPackages } from "./package-quality-report.mts";

export type PublicApiExport = {
  readonly name: string;
  readonly exportKind: "declaration" | "named" | "namespace" | "star";
  readonly source: string | null;
  readonly localName?: string;
  readonly declarationKind?: string;
  readonly compatibilityGroup?: string;
};

export type PublicApiCompatibilityGroup = {
  readonly id: string;
  readonly title: string;
  readonly owner: string;
  readonly breakingChangePolicy: string;
  readonly coverage: readonly string[];
};

export type PublicApiPackage = {
  readonly packageName: string;
  readonly relativeDir: string;
  readonly entrypoint: string;
  readonly compatibilityGroups?: readonly PublicApiCompatibilityGroup[];
  readonly runtimeExports: readonly PublicApiExport[];
  readonly typeExports: readonly PublicApiExport[];
};

export type PublicApiSnapshot = {
  readonly schemaVersion: 1;
  readonly packages: readonly PublicApiPackage[];
};

export type ExportSurfaceDiff = {
  readonly added: readonly PublicApiExport[];
  readonly removed: readonly PublicApiExport[];
};

export type PackageApiDiff = {
  readonly packageName: string;
  readonly relativeDir: string;
  readonly runtime: ExportSurfaceDiff;
  readonly type: ExportSurfaceDiff;
  readonly compatibilityGroupMetadata: PublicApiCompatibilityGroupMetadataDiff;
  readonly compatibilityGroupImpacts: readonly PublicApiCompatibilityGroupImpact[];
  readonly packageStatus: "added" | "removed" | "changed";
};

export type PublicApiDiff = {
  readonly packages: readonly PackageApiDiff[];
};

export type PublicApiSummary = {
  readonly status: "pass" | "fail";
  readonly packageCount: number;
  readonly changedPackages: number;
  readonly runtimeAdded: number;
  readonly runtimeRemoved: number;
  readonly typeAdded: number;
  readonly typeRemoved: number;
  readonly snapshotPath: string;
  readonly reportPath: string;
  readonly updateCommand: string;
};

type Mode = "check" | "write";

type CheckOptions = {
  readonly mode: Mode;
  readonly rootDir: string;
  readonly snapshotPath: string;
  readonly reportDir: string;
};

type ExportSurface = "runtime" | "type";

type FileExportSurface = Pick<PublicApiPackage, "runtimeExports" | "typeExports">;

type PublicApiCompatibilityGroupImpact = PublicApiCompatibilityGroup & {
  readonly runtimeAdded: number;
  readonly runtimeRemoved: number;
  readonly typeAdded: number;
  readonly typeRemoved: number;
};

type PublicApiCompatibilityGroupMetadataChange = {
  readonly groupId: string;
  readonly previous: PublicApiCompatibilityGroup;
  readonly current: PublicApiCompatibilityGroup;
};

type PublicApiCompatibilityGroupMetadataDiff = {
  readonly added: readonly PublicApiCompatibilityGroup[];
  readonly removed: readonly PublicApiCompatibilityGroup[];
  readonly changed: readonly PublicApiCompatibilityGroupMetadataChange[];
};

type ExtractContext = {
  readonly activeFiles: Set<string>;
  readonly cache: Map<string, FileExportSurface>;
};

type PublicApiCompatibilityGroupExportRule = {
  readonly source: string | null;
  readonly names: readonly string[];
};

type PublicApiCompatibilityGroupRule = {
  readonly groupId: string;
  readonly exports: readonly PublicApiCompatibilityGroupExportRule[];
};

type PublicApiCompatibilityContract = {
  readonly groups: readonly PublicApiCompatibilityGroup[];
  readonly rules: readonly PublicApiCompatibilityGroupRule[];
};

const snapshotFileName = "public-api-surface.snapshot.json";
const reportDirectory = join("ci-reports", "package-quality");
const reportFileName = "public-api-diff.md";
const summaryFileName = "public-api-summary.json";

const frameworkContextCompatibilityContract = {
  groups: [
    {
      id: "di",
      title: "DI and dependency graph",
      owner: "Framework Context DI owner",
      breakingChangePolicy:
        "Renames, removals, scope semantics, diagnostic-code changes, or graph manifest changes are breaking for DI consumers and generated apps.",
      coverage: [
        "public-api:check grouped snapshot",
        "create-croco-app generator imports DI primitives",
        "croco doctor DI diagnostics",
      ],
    },
    {
      id: "context",
      title: "Request and runtime context",
      owner: "Framework Context request-context owner",
      breakingChangePolicy:
        "RequestContext, RuntimeContext, transaction-context, and lifecycle field removals or semantic changes require a migration note and versioned compatibility review.",
      coverage: [
        "public-api:check grouped snapshot",
        "generated app request context imports",
        "doctor/project-map runtime context reads",
      ],
    },
    {
      id: "runtime-policy",
      title: "Runtime policy",
      owner: "Runtime policy owner",
      breakingChangePolicy:
        "Policy table shape, policy kind/target constants, capability diagnostics, and execution-plan semantics are release-blocking compatibility changes.",
      coverage: [
        "public-api:check grouped snapshot",
        "croco runtime-policy check",
        "croco project-map policy validation",
      ],
    },
    {
      id: "runtime-capability",
      title: "Runtime capability",
      owner: "Runtime capability owner",
      breakingChangePolicy:
        "Capability names, platform names, manifest versions, diagnostic codes, and support matrix semantics are breaking unless versioned or explicitly migrated.",
      coverage: [
        "public-api:check grouped snapshot",
        "croco runtime-policy check",
        "generated app smoke workspace build",
      ],
    },
    {
      id: "runtime-inspector",
      title: "Runtime inspector",
      owner: "Runtime inspector owner",
      breakingChangePolicy:
        "Inspector record/timeline/event shape changes must preserve additive compatibility or document a versioned diagnostic migration.",
      coverage: [
        "public-api:check grouped snapshot",
        "generated app smoke workspace build",
        "doctor/project-map runtime diagnostics",
      ],
    },
    {
      id: "middleware",
      title: "Middleware and request pipeline",
      owner: "Middleware pipeline owner",
      breakingChangePolicy:
        "Middleware callable shape, pipeline graph node/phase constants, and failure propagation changes require a documented migration path.",
      coverage: ["public-api:check grouped snapshot", "generated app request pipeline usage"],
    },
    {
      id: "shutdown",
      title: "Shutdown lifecycle",
      owner: "Shutdown lifecycle owner",
      breakingChangePolicy:
        "Shutdown hook signatures, timeout/configuration problem behavior, and signal listener semantics are breaking without migration guidance.",
      coverage: ["public-api:check grouped snapshot", "generated app smoke workspace build"],
    },
  ],
  rules: [
    {
      groupId: "di",
      exports: [
        {
          source: "./libs/Container",
          names: ["Container", "ContainerValidationOptions", "TokenIdentifier"],
        },
        {
          source: "./libs/decorators/Component",
          names: ["Component"],
        },
        {
          source: "./libs/decorators/Inject",
          names: ["Inject"],
        },
        {
          source: "./libs/diagnostics/ContainerDiagnosticsProvider",
          names: ["ContainerDiagnosticsProvider"],
        },
        {
          source: "./libs/ILogger",
          names: ["ILogger", "LOGGER_TOKEN"],
        },
        {
          source: "./libs/MetadataStorage",
          names: ["MetadataStorage"],
        },
        {
          source: "./libs/problems/CircularDependencyProblem",
          names: ["CircularDependencyProblem"],
        },
        {
          source: "./libs/problems/ContainerResolutionProblem",
          names: [
            "ContainerResolutionFailureReason",
            "ContainerResolutionProblem",
            "ContainerScopeMismatchProblem",
          ],
        },
        {
          source: "./libs/types",
          names: [
            "ComponentMetadata",
            "ComponentOptions",
            "Constructor",
            "DependencyGraphDiagnostic",
            "DependencyGraphDiagnosticCode",
            "DependencyGraphLegacyDiagnosticCode",
            "DependencyGraphManifest",
            "DependencyGraphManifestStatus",
            "DependencyGraphManifestVersion",
            "DependencyGraphProvider",
            "DependencyProviderKind",
            "DependencyResolutionStep",
            "DependencyResolutionStepStatus",
            "DependencyResolutionTrace",
            "DependencyResolutionTraceStatus",
            "DependencySourceLocation",
            "DependencyTokenKind",
            "Scope",
          ],
        },
        {
          source: "typedi",
          names: ["ContainerInstance", "Token"],
        },
      ],
    },
    {
      groupId: "context",
      exports: [
        {
          source: "./libs/Context",
          names: ["Context"],
        },
        {
          source: "./libs/TransactionContext",
          names: ["TRANSACTION_CONTEXT_TOKEN", "TransactionContext"],
        },
        {
          source: "./libs/types",
          names: [
            "LifecycleHooks",
            "RequestContext",
            "RuntimeContext",
            "RuntimeNativeContext",
            "RuntimeTraceContext",
          ],
        },
      ],
    },
    {
      groupId: "runtime-policy",
      exports: [
        {
          source: "./libs/problems/RuntimePolicyProblems",
          names: [
            "POLICY_CAPABILITY_UNAVAILABLE_CODE",
            "PolicyCapabilityProblem",
            "PolicyConflictProblem",
            "PolicyDefinitionProblem",
          ],
        },
        {
          source: "./libs/RuntimePolicy",
          names: [
            "DefinePolicyOptions",
            "DefineRuntimePolicyOptions",
            "POLICY_EXECUTION_ORDER",
            "POLICY_KINDS",
            "POLICY_TARGET_KINDS",
            "PolicyCapabilityDiagnostic",
            "PolicyDefinition",
            "PolicyExecutionEntry",
            "PolicyExecutionPlan",
            "PolicyFailurePropagation",
            "PolicyFailurePropagationEntry",
            "PolicyKind",
            "PolicyRuntimeCapability",
            "PolicySource",
            "PolicyTable",
            "PolicyTarget",
            "PolicyTargetKind",
            "RetryPolicyDefinition",
            "RuntimePolicy",
            "RuntimePolicyPresetConfig",
            "TimeoutPolicy",
            "TracingPolicy",
            "assertPolicyRuntimeCapabilities",
            "assertPolicyRuntimeCapabilityManifest",
            "assertPolicyTableRuntimeCapabilities",
            "assertPolicyTableRuntimeCapabilityManifest",
            "checkPolicyRuntimeCapabilities",
            "checkPolicyRuntimeCapabilityManifest",
            "checkPolicyTableRuntimeCapabilities",
            "checkPolicyTableRuntimeCapabilityManifest",
            "compilePolicyTable",
            "compilePolicyTableForRuntime",
            "createPolicyTarget",
            "definePolicy",
            "definePolicyForRuntime",
            "defineRuntimePolicyPreset",
            "formatPolicyCapabilityDiagnostic",
            "getPolicyExecutionPlan",
            "getRuntimePolicyPresetCapabilities",
          ],
        },
      ],
    },
    {
      groupId: "runtime-capability",
      exports: [
        {
          source: "./libs/runtimeCapabilities",
          names: [
            "RUNTIME_CAPABILITY_MANIFEST_VERSION",
            "RUNTIME_CAPABILITY_NAMES",
            "RUNTIME_CAPABILITY_SUPPORT",
            "RUNTIME_CAPABILITY_UNSUPPORTED_DIAGNOSTIC_CODE",
            "RUNTIME_PLATFORMS",
            "RuntimeCapabilitiesForPlatform",
            "RuntimeCapabilityOverridesFor",
            "RuntimeCapabilitySupport",
            "RuntimeCapabilitySupportForPlatform",
            "RuntimeCapabilitySupportMatrix",
            "SupportedRuntimeCapabilityName",
            "UnsupportedRuntimeCapabilityName",
            "checkRuntimeCapabilityRequirements",
            "createRuntimeCapabilityDiagnostic",
            "createRuntimeCapabilityManifest",
            "createRuntimeCapabilityManifestFromSupport",
            "getRuntimeCapabilitySupport",
            "isKnownRuntimePlatform",
            "isRuntimeCapabilitySupported",
            "stringifyRuntimeCapabilityManifest",
          ],
        },
        {
          source: "./libs/types",
          names: [
            "KnownRuntimePlatform",
            "RuntimeCapabilities",
            "RuntimeCapabilityDiagnostic",
            "RuntimeCapabilityDiagnosticCode",
            "RuntimeCapabilityManifest",
            "RuntimeCapabilityManifestVersion",
            "RuntimeCapabilityName",
            "RuntimeCapabilityRequirement",
            "RuntimePlatform",
          ],
        },
      ],
    },
    {
      groupId: "runtime-inspector",
      exports: [
        {
          source: "./libs/RuntimeInspector",
          names: [
            "DEV_INSPECTOR_TOKEN",
            "RuntimeInspectionOutcome",
            "RuntimeInspectionRecord",
            "RuntimeInspector",
            "RuntimeInspectorEventInput",
            "RuntimeInspectorEventKind",
            "RuntimeInspectorEventOutcome",
            "RuntimeInspectorFailureReporter",
            "RuntimeInspectorOptions",
            "RuntimeInspectorRequestFinish",
            "RuntimeInspectorRequestStart",
            "RuntimeInspectorSnapshot",
            "RuntimeInspectorTimelineEvent",
            "finishRuntimeInspectionRequest",
            "recordRuntimeInspectionEvent",
            "startRuntimeInspectionRequest",
          ],
        },
        {
          source: "./libs/types",
          names: ["RuntimeInspectorRecorder", "RuntimeInspectorRecorderEventInput"],
        },
      ],
    },
    {
      groupId: "middleware",
      exports: [
        {
          source: "./libs/Guard",
          names: ["Guard"],
        },
        {
          source: "./libs/Middleware",
          names: ["MiddlewareChain"],
        },
        {
          source: "./libs/problems/MiddlewareProblems",
          names: ["MiddlewareProblem"],
        },
        {
          source: "./libs/problems/PipelineGraphProblems",
          names: ["PipelineGraphProblem"],
        },
        {
          source: "./libs/RequestPipelineGraph",
          names: [
            "CompileRequestPipelineGraphOptions",
            "PolicyPipelineNodeOptions",
            "REQUEST_PIPELINE_FAILURE_PROPAGATIONS",
            "REQUEST_PIPELINE_NODE_KINDS",
            "REQUEST_PIPELINE_PHASES",
            "RequestPipelineFailurePropagation",
            "RequestPipelineGraph",
            "RequestPipelineGraphEdge",
            "RequestPipelineGraphEdgeReason",
            "RequestPipelineNode",
            "RequestPipelineNodeKind",
            "RequestPipelinePath",
            "RequestPipelinePhase",
            "RequestPipelinePhaseOrder",
            "ResolvedRequestPipelineNode",
            "compileRequestPipelineGraph",
            "dumpRequestPipelineGraph",
            "requestPipelineNodesFromPolicyPlan",
          ],
        },
        {
          source: "./libs/types",
          names: ["Middleware"],
        },
      ],
    },
    {
      groupId: "shutdown",
      exports: [
        {
          source: "./libs/decorators/OnShutdown",
          names: ["OnShutdown"],
        },
        {
          source: "./libs/problems/ShutdownProblems",
          names: [
            "OnShutdownDecoratorFailureReason",
            "OnShutdownDecoratorProblem",
            "ShutdownConfigurationConflictProblem",
            "ShutdownTimeoutProblem",
          ],
        },
        {
          source: "./libs/ShutdownManager",
          names: ["ShutdownManager"],
        },
        {
          source: "./libs/types",
          names: ["ShutdownHook"],
        },
      ],
    },
  ],
} as const satisfies PublicApiCompatibilityContract;

const compatibilityContractsByPackage = new Map<string, PublicApiCompatibilityContract>([
  ["@croco/framework-context", frameworkContextCompatibilityContract],
]);

function log(message: string): void {
  stdout.write(`${message}\n`);
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind)
  );
}

function moduleSpecifierText(moduleSpecifier: ts.Expression | undefined): string | null {
  return moduleSpecifier && ts.isStringLiteral(moduleSpecifier) ? moduleSpecifier.text : null;
}

function addExport(
  exportsBySurface: Record<ExportSurface, PublicApiExport[]>,
  surface: ExportSurface,
  entry: PublicApiExport,
): void {
  exportsBySurface[surface].push(entry);
}

function getVariableDeclarationKind(declarationList: ts.VariableDeclarationList): string {
  if ((declarationList.flags & ts.NodeFlags.Const) !== 0) {
    return "const";
  }

  if ((declarationList.flags & ts.NodeFlags.Let) !== 0) {
    return "let";
  }

  return "var";
}

function collectBindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) {
    return [name.text];
  }

  if (ts.isObjectBindingPattern(name)) {
    return name.elements.flatMap((element) => collectBindingNames(element.name));
  }

  return name.elements.flatMap((element) => {
    if (ts.isOmittedExpression(element)) {
      return [];
    }

    return collectBindingNames(element.name);
  });
}

function createEmptySurface(): Record<ExportSurface, PublicApiExport[]> {
  return {
    runtime: [],
    type: [],
  };
}

function resolveLocalModule(fromFile: string, moduleSpecifier: string | null): string | null {
  if (!moduleSpecifier?.startsWith(".")) {
    return null;
  }

  const basePath = resolve(dirname(fromFile), moduleSpecifier);
  const candidates = [
    basePath,
    basePath.replace(/\.js$/, ".ts"),
    basePath.replace(/\.js$/, ".tsx"),
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    `${basePath}.cts`,
    join(basePath, "index.ts"),
    join(basePath, "index.tsx"),
    join(basePath, "index.mts"),
    join(basePath, "index.cts"),
  ];

  return (
    candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
  );
}

function entryWithSourceFallback(entry: PublicApiExport, source: string | null): PublicApiExport {
  return entry.source || !source ? entry : { ...entry, source };
}

function findExportByName(
  exports: readonly PublicApiExport[],
  name: string,
): PublicApiExport | null {
  return exports.find((entry) => entry.name === name) ?? null;
}

function inferNamedExportSurface(
  name: string,
  declarations: FileExportSurface,
): { readonly surface: ExportSurface; readonly declaration: PublicApiExport | null } {
  const runtimeDeclaration = findExportByName(declarations.runtimeExports, name);
  if (runtimeDeclaration) {
    return { surface: "runtime", declaration: runtimeDeclaration };
  }

  const typeDeclaration = findExportByName(declarations.typeExports, name);
  if (typeDeclaration) {
    return { surface: "type", declaration: typeDeclaration };
  }

  return { surface: "runtime", declaration: null };
}

function getDeclarationEntries(statement: ts.Statement, exportMode: boolean): FileExportSurface {
  const exportsBySurface = createEmptySurface();
  const isDefault = exportMode && hasModifier(statement, ts.SyntaxKind.DefaultKeyword);

  if (ts.isInterfaceDeclaration(statement)) {
    addExport(exportsBySurface, "type", {
      name: statement.name.text,
      exportKind: "declaration",
      source: null,
      declarationKind: "interface",
    });
  }

  if (ts.isTypeAliasDeclaration(statement)) {
    addExport(exportsBySurface, "type", {
      name: statement.name.text,
      exportKind: "declaration",
      source: null,
      declarationKind: "type",
    });
  }

  if (ts.isClassDeclaration(statement)) {
    const localName = statement.name?.text;
    addExport(exportsBySurface, "runtime", {
      name: isDefault ? "default" : (localName ?? "<anonymous-class>"),
      exportKind: "declaration",
      source: null,
      ...(localName && isDefault ? { localName } : {}),
      declarationKind: "class",
    });
  }

  if (ts.isFunctionDeclaration(statement)) {
    const localName = statement.name?.text;
    addExport(exportsBySurface, "runtime", {
      name: isDefault ? "default" : (localName ?? "<anonymous-function>"),
      exportKind: "declaration",
      source: null,
      ...(localName && isDefault ? { localName } : {}),
      declarationKind: "function",
    });
  }

  if (ts.isEnumDeclaration(statement)) {
    addExport(exportsBySurface, "runtime", {
      name: statement.name.text,
      exportKind: "declaration",
      source: null,
      declarationKind: hasModifier(statement, ts.SyntaxKind.ConstKeyword) ? "const enum" : "enum",
    });
  }

  if (ts.isVariableStatement(statement)) {
    const declarationKind = getVariableDeclarationKind(statement.declarationList);
    for (const declaration of statement.declarationList.declarations) {
      for (const name of collectBindingNames(declaration.name)) {
        addExport(exportsBySurface, "runtime", {
          name,
          exportKind: "declaration",
          source: null,
          declarationKind,
        });
      }
    }
  }

  if (ts.isModuleDeclaration(statement) && ts.isIdentifier(statement.name)) {
    addExport(
      exportsBySurface,
      hasModifier(statement, ts.SyntaxKind.DeclareKeyword) ? "type" : "runtime",
      {
        name: statement.name.text,
        exportKind: "declaration",
        source: null,
        declarationKind: "namespace",
      },
    );
  }

  return {
    runtimeExports: exportsBySurface.runtime,
    typeExports: exportsBySurface.type,
  };
}

function collectLocalDeclarations(sourceFile: ts.SourceFile): FileExportSurface {
  const exportsBySurface = createEmptySurface();

  for (const statement of sourceFile.statements) {
    const entries = getDeclarationEntries(statement, false);
    exportsBySurface.runtime.push(...entries.runtimeExports);
    exportsBySurface.type.push(...entries.typeExports);
  }

  return {
    runtimeExports: exportsBySurface.runtime,
    typeExports: exportsBySurface.type,
  };
}

function addExportDeclaration(
  statement: ts.ExportDeclaration,
  exportsBySurface: Record<ExportSurface, PublicApiExport[]>,
  filePath: string,
  context: ExtractContext,
  localDeclarations: FileExportSurface,
): void {
  const source = moduleSpecifierText(statement.moduleSpecifier);
  const surface: ExportSurface = statement.isTypeOnly ? "type" : "runtime";
  const resolvedSource = resolveLocalModule(filePath, source);

  if (!statement.exportClause) {
    if (resolvedSource) {
      const targetExports = extractEntrypointExports(resolvedSource, context);
      if (!statement.isTypeOnly) {
        exportsBySurface.runtime.push(
          ...targetExports.runtimeExports.map((entry) => entryWithSourceFallback(entry, source)),
        );
      }
      exportsBySurface.type.push(
        ...targetExports.typeExports.map((entry) => entryWithSourceFallback(entry, source)),
      );
      return;
    }

    addExport(exportsBySurface, surface, {
      name: "*",
      exportKind: "star",
      source,
    });
    return;
  }

  if (ts.isNamespaceExport(statement.exportClause)) {
    addExport(exportsBySurface, surface, {
      name: statement.exportClause.name.text,
      exportKind: "namespace",
      source,
    });
    return;
  }

  for (const specifier of statement.exportClause.elements) {
    const localName = specifier.propertyName?.text ?? specifier.name.text;
    const explicitTypeOnly = statement.isTypeOnly || specifier.isTypeOnly;
    const inferred = explicitTypeOnly
      ? { surface: "type" as const, declaration: null }
      : inferNamedExportSurface(
          localName,
          resolvedSource ? extractEntrypointExports(resolvedSource, context) : localDeclarations,
        );

    addExport(exportsBySurface, inferred.surface, {
      name: specifier.name.text,
      exportKind: "named",
      source,
      ...(specifier.propertyName && specifier.propertyName.text !== specifier.name.text
        ? { localName: specifier.propertyName.text }
        : {}),
      ...(inferred.declaration?.declarationKind
        ? { declarationKind: inferred.declaration.declarationKind }
        : {}),
    });
  }
}

function addExportedDeclaration(
  statement: ts.Statement,
  exportsBySurface: Record<ExportSurface, PublicApiExport[]>,
): void {
  if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
    return;
  }

  const entries = getDeclarationEntries(statement, true);
  exportsBySurface.runtime.push(...entries.runtimeExports);
  exportsBySurface.type.push(...entries.typeExports);
}

function extractEntrypointExports(
  entrypointPath: string,
  context: ExtractContext = { activeFiles: new Set(), cache: new Map() },
): Pick<PublicApiPackage, "runtimeExports" | "typeExports"> {
  const cached = context.cache.get(entrypointPath);
  if (cached) {
    return cached;
  }

  if (context.activeFiles.has(entrypointPath)) {
    return {
      runtimeExports: [],
      typeExports: [],
    };
  }

  context.activeFiles.add(entrypointPath);

  const source = readFileSync(entrypointPath, "utf-8");
  const sourceFile = ts.createSourceFile(
    entrypointPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const exportsBySurface: Record<ExportSurface, PublicApiExport[]> = {
    runtime: [],
    type: [],
  };
  const localDeclarations = collectLocalDeclarations(sourceFile);

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      addExportDeclaration(statement, exportsBySurface, entrypointPath, context, localDeclarations);
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      addExport(exportsBySurface, "runtime", {
        name: statement.isExportEquals ? "export=" : "default",
        exportKind: "named",
        source: null,
      });
      continue;
    }

    addExportedDeclaration(statement, exportsBySurface);
  }

  const surface = {
    runtimeExports: sortExports(dedupeExports(exportsBySurface.runtime)),
    typeExports: sortExports(dedupeExports(exportsBySurface.type)),
  };

  context.cache.set(entrypointPath, surface);
  context.activeFiles.delete(entrypointPath);

  return surface;
}

function exportKey(entry: PublicApiExport): string {
  return JSON.stringify([
    entry.exportKind,
    entry.name,
    entry.source,
    entry.localName ?? null,
    entry.declarationKind ?? null,
    entry.compatibilityGroup ?? null,
  ]);
}

function dedupeExports(entries: readonly PublicApiExport[]): PublicApiExport[] {
  return [...new Map(entries.map((entry) => [exportKey(entry), entry])).values()];
}

function sortExports(entries: readonly PublicApiExport[]): PublicApiExport[] {
  return [...entries].sort((left, right) => exportKey(left).localeCompare(exportKey(right)));
}

function describeExportForContract(entry: PublicApiExport): string {
  const source = entry.source ? ` from ${entry.source}` : "";
  const declaration = entry.declarationKind ? ` (${entry.declarationKind})` : "";
  const localName = entry.localName ? `${entry.localName} as ` : "";

  return `${localName}${entry.name}${source}${declaration}`;
}

function isRuleMatch(entry: PublicApiExport, rule: PublicApiCompatibilityGroupRule): boolean {
  return rule.exports.some(
    (exportRule) => exportRule.source === entry.source && exportRule.names.includes(entry.name),
  );
}

function resolveCompatibilityGroup(
  packageName: string,
  entry: PublicApiExport,
  contract: PublicApiCompatibilityContract,
): string {
  const matchingRules = contract.rules.filter((rule) => isRuleMatch(entry, rule));

  if (matchingRules.length === 1) {
    return matchingRules[0].groupId;
  }

  if (matchingRules.length > 1) {
    throw new Error(
      `public API compatibility contract for ${packageName} classifies ${describeExportForContract(
        entry,
      )} into multiple groups: ${matchingRules.map((rule) => rule.groupId).join(", ")}`,
    );
  }

  throw new Error(
    `public API compatibility contract for ${packageName} does not classify ${describeExportForContract(
      entry,
    )}`,
  );
}

function withCompatibilityGroups(
  packageName: string,
  entries: readonly PublicApiExport[],
): readonly PublicApiExport[] {
  const contract = compatibilityContractsByPackage.get(packageName);

  if (!contract) {
    return entries;
  }

  const groupIds = new Set(contract.groups.map((group) => group.id));

  return sortExports(
    entries.map((entry) => {
      const compatibilityGroup = resolveCompatibilityGroup(packageName, entry, contract);

      if (!groupIds.has(compatibilityGroup)) {
        throw new Error(
          `public API compatibility contract for ${packageName} references unknown group ${compatibilityGroup}`,
        );
      }

      return {
        ...entry,
        compatibilityGroup,
      };
    }),
  );
}

export function createPublicApiSnapshot(rootDir: string): PublicApiSnapshot {
  const packages = readPackages(rootDir)
    .filter((pkg) => !pkg.private)
    .flatMap((pkg): PublicApiPackage[] => {
      const entrypoint = join(rootDir, pkg.relativeDir, "src", "index.ts");

      if (!existsSync(entrypoint)) {
        return [];
      }

      const exports = extractEntrypointExports(entrypoint);
      const compatibilityContract = compatibilityContractsByPackage.get(pkg.name);

      return [
        {
          packageName: pkg.name,
          relativeDir: pkg.relativeDir,
          entrypoint: toPosixPath(relative(rootDir, entrypoint)),
          ...(compatibilityContract ? { compatibilityGroups: compatibilityContract.groups } : {}),
          runtimeExports: withCompatibilityGroups(pkg.name, exports.runtimeExports),
          typeExports: withCompatibilityGroups(pkg.name, exports.typeExports),
        },
      ];
    })
    .sort((left, right) => left.packageName.localeCompare(right.packageName));

  return {
    schemaVersion: 1,
    packages,
  };
}

function parseExport(value: unknown): PublicApiExport {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.exportKind !== "string") {
    throw new Error("public API snapshot contains an invalid export entry");
  }

  const exportKind = value.exportKind;
  if (
    exportKind !== "declaration" &&
    exportKind !== "named" &&
    exportKind !== "namespace" &&
    exportKind !== "star"
  ) {
    throw new Error(`public API snapshot contains an invalid export kind: ${exportKind}`);
  }

  const sourceCandidate = value.source;
  let source: string | null = null;
  if (typeof sourceCandidate === "string") {
    source = sourceCandidate;
  } else if (sourceCandidate !== null) {
    throw new Error("public API snapshot export source must be a string or null");
  }

  return {
    name: value.name,
    exportKind,
    source,
    ...(typeof value.localName === "string" ? { localName: value.localName } : {}),
    ...(typeof value.declarationKind === "string"
      ? { declarationKind: value.declarationKind }
      : {}),
    ...(typeof value.compatibilityGroup === "string"
      ? { compatibilityGroup: value.compatibilityGroup }
      : {}),
  };
}

function parseCompatibilityGroup(value: unknown): PublicApiCompatibilityGroup {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.owner !== "string" ||
    typeof value.breakingChangePolicy !== "string" ||
    !Array.isArray(value.coverage) ||
    !value.coverage.every((entry) => typeof entry === "string")
  ) {
    throw new Error("public API snapshot contains an invalid compatibility group");
  }

  return {
    id: value.id,
    title: value.title,
    owner: value.owner,
    breakingChangePolicy: value.breakingChangePolicy,
    coverage: value.coverage,
  };
}

function parsePackage(value: unknown): PublicApiPackage {
  if (
    !isRecord(value) ||
    typeof value.packageName !== "string" ||
    typeof value.relativeDir !== "string" ||
    typeof value.entrypoint !== "string" ||
    !Array.isArray(value.runtimeExports) ||
    !Array.isArray(value.typeExports)
  ) {
    throw new Error("public API snapshot contains an invalid package entry");
  }

  const compatibilityGroups = Array.isArray(value.compatibilityGroups)
    ? value.compatibilityGroups.map(parseCompatibilityGroup)
    : undefined;
  const groupIds = new Set(compatibilityGroups?.map((group) => group.id) ?? []);
  const runtimeExports = sortExports(value.runtimeExports.map(parseExport));
  const typeExports = sortExports(value.typeExports.map(parseExport));

  if (compatibilityGroups) {
    for (const entry of [...runtimeExports, ...typeExports]) {
      if (!entry.compatibilityGroup) {
        throw new Error(
          `public API snapshot package ${value.packageName} has grouped exports without compatibilityGroup on ${entry.name}`,
        );
      }

      if (!groupIds.has(entry.compatibilityGroup)) {
        throw new Error(
          `public API snapshot package ${value.packageName} references unknown compatibilityGroup ${entry.compatibilityGroup}`,
        );
      }
    }
  }

  if (
    !compatibilityGroups &&
    [...runtimeExports, ...typeExports].some((entry) => entry.compatibilityGroup)
  ) {
    throw new Error(
      `public API snapshot package ${value.packageName} has compatibilityGroup tags without compatibilityGroups metadata`,
    );
  }

  return {
    packageName: value.packageName,
    relativeDir: value.relativeDir,
    entrypoint: value.entrypoint,
    ...(compatibilityGroups ? { compatibilityGroups } : {}),
    runtimeExports,
    typeExports,
  };
}

export function parsePublicApiSnapshot(value: unknown): PublicApiSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.packages)) {
    throw new Error("public API snapshot must use schemaVersion 1 and include packages");
  }

  return {
    schemaVersion: 1,
    packages: value.packages
      .map(parsePackage)
      .sort((left, right) => left.packageName.localeCompare(right.packageName)),
  };
}

function readPublicApiSnapshot(snapshotPath: string): PublicApiSnapshot | null {
  if (!existsSync(snapshotPath)) {
    return null;
  }

  return parsePublicApiSnapshot(JSON.parse(readFileSync(snapshotPath, "utf-8")) as unknown);
}

function diffExportSurface(
  previous: readonly PublicApiExport[],
  current: readonly PublicApiExport[],
): ExportSurfaceDiff {
  const previousByKey = new Map(previous.map((entry) => [exportKey(entry), entry]));
  const currentByKey = new Map(current.map((entry) => [exportKey(entry), entry]));

  return {
    added: sortExports(
      [...currentByKey.entries()].flatMap(([key, entry]) =>
        previousByKey.has(key) ? [] : [entry],
      ),
    ),
    removed: sortExports(
      [...previousByKey.entries()].flatMap(([key, entry]) =>
        currentByKey.has(key) ? [] : [entry],
      ),
    ),
  };
}

function compatibilityGroupMetadataKey(group: PublicApiCompatibilityGroup): string {
  return JSON.stringify([group.title, group.owner, group.breakingChangePolicy, group.coverage]);
}

function sortCompatibilityGroups(
  groups: readonly PublicApiCompatibilityGroup[],
): PublicApiCompatibilityGroup[] {
  return [...groups].sort((left, right) => left.id.localeCompare(right.id));
}

function diffCompatibilityGroupMetadata(
  previous: readonly PublicApiCompatibilityGroup[] = [],
  current: readonly PublicApiCompatibilityGroup[] = [],
): PublicApiCompatibilityGroupMetadataDiff {
  const previousById = new Map(previous.map((group) => [group.id, group]));
  const currentById = new Map(current.map((group) => [group.id, group]));
  const groupIds = [...new Set([...previousById.keys(), ...currentById.keys()])].sort();

  const added: PublicApiCompatibilityGroup[] = [];
  const removed: PublicApiCompatibilityGroup[] = [];
  const changed: PublicApiCompatibilityGroupMetadataChange[] = [];

  for (const groupId of groupIds) {
    const previousGroup = previousById.get(groupId);
    const currentGroup = currentById.get(groupId);

    if (!previousGroup && currentGroup) {
      added.push(currentGroup);
      continue;
    }

    if (previousGroup && !currentGroup) {
      removed.push(previousGroup);
      continue;
    }

    if (
      previousGroup &&
      currentGroup &&
      compatibilityGroupMetadataKey(previousGroup) !== compatibilityGroupMetadataKey(currentGroup)
    ) {
      changed.push({
        groupId,
        previous: previousGroup,
        current: currentGroup,
      });
    }
  }

  return {
    added: sortCompatibilityGroups(added),
    removed: sortCompatibilityGroups(removed),
    changed,
  };
}

function hasCompatibilityGroupMetadataDiff(diff: PublicApiCompatibilityGroupMetadataDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
}

function countEntriesForGroup(entries: readonly PublicApiExport[], groupId: string): number {
  return entries.filter((entry) => entry.compatibilityGroup === groupId).length;
}

function buildCompatibilityGroupImpacts(
  previousPackage: PublicApiPackage | undefined,
  currentPackage: PublicApiPackage | undefined,
  runtime: ExportSurfaceDiff,
  type: ExportSurfaceDiff,
): readonly PublicApiCompatibilityGroupImpact[] {
  const groups = [
    ...(previousPackage?.compatibilityGroups ?? []),
    ...(currentPackage?.compatibilityGroups ?? []),
  ];

  if (groups.length === 0) {
    return [];
  }

  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const changedGroupIds = new Set(
    [...runtime.added, ...runtime.removed, ...type.added, ...type.removed].flatMap((entry) =>
      entry.compatibilityGroup ? [entry.compatibilityGroup] : [],
    ),
  );

  return [...changedGroupIds].sort().flatMap((groupId): PublicApiCompatibilityGroupImpact[] => {
    const group = groupsById.get(groupId);

    if (!group) {
      return [];
    }

    return [
      {
        ...group,
        runtimeAdded: countEntriesForGroup(runtime.added, groupId),
        runtimeRemoved: countEntriesForGroup(runtime.removed, groupId),
        typeAdded: countEntriesForGroup(type.added, groupId),
        typeRemoved: countEntriesForGroup(type.removed, groupId),
      },
    ];
  });
}

export function diffPublicApiSnapshots(
  previous: PublicApiSnapshot,
  current: PublicApiSnapshot,
): PublicApiDiff {
  const previousByPackage = new Map(previous.packages.map((pkg) => [pkg.packageName, pkg]));
  const currentByPackage = new Map(current.packages.map((pkg) => [pkg.packageName, pkg]));
  const packageNames = [
    ...new Set([...previousByPackage.keys(), ...currentByPackage.keys()]),
  ].sort();

  const packages = packageNames.flatMap((packageName): PackageApiDiff[] => {
    const previousPackage = previousByPackage.get(packageName);
    const currentPackage = currentByPackage.get(packageName);
    const relativeDir = currentPackage?.relativeDir ?? previousPackage?.relativeDir ?? "";
    const runtime = diffExportSurface(
      previousPackage?.runtimeExports ?? [],
      currentPackage?.runtimeExports ?? [],
    );
    const type = diffExportSurface(
      previousPackage?.typeExports ?? [],
      currentPackage?.typeExports ?? [],
    );
    const compatibilityGroupMetadata = diffCompatibilityGroupMetadata(
      previousPackage?.compatibilityGroups,
      currentPackage?.compatibilityGroups,
    );

    if (
      runtime.added.length === 0 &&
      runtime.removed.length === 0 &&
      type.added.length === 0 &&
      type.removed.length === 0 &&
      !hasCompatibilityGroupMetadataDiff(compatibilityGroupMetadata)
    ) {
      return [];
    }

    return [
      {
        packageName,
        relativeDir,
        runtime,
        type,
        compatibilityGroupMetadata,
        compatibilityGroupImpacts: buildCompatibilityGroupImpacts(
          previousPackage,
          currentPackage,
          runtime,
          type,
        ),
        packageStatus: previousPackage ? (currentPackage ? "changed" : "removed") : "added",
      },
    ];
  });

  return { packages };
}

function countDiff(
  diff: PublicApiDiff,
  surface: ExportSurface,
  change: keyof ExportSurfaceDiff,
): number {
  return diff.packages.reduce((count, pkg) => count + pkg[surface][change].length, 0);
}

export function summarizePublicApiDiff(
  current: PublicApiSnapshot,
  diff: PublicApiDiff,
  snapshotPath: string,
  reportPath: string,
): PublicApiSummary {
  const changedPackages = diff.packages.length;

  return {
    status: changedPackages === 0 ? "pass" : "fail",
    packageCount: current.packages.length,
    changedPackages,
    runtimeAdded: countDiff(diff, "runtime", "added"),
    runtimeRemoved: countDiff(diff, "runtime", "removed"),
    typeAdded: countDiff(diff, "type", "added"),
    typeRemoved: countDiff(diff, "type", "removed"),
    snapshotPath,
    reportPath,
    updateCommand: "pnpm public-api:write",
  };
}

function formatExport(entry: PublicApiExport): string {
  const source = entry.source ? ` from ${entry.source}` : "";
  const declaration = entry.declarationKind ? ` (${entry.declarationKind})` : "";
  const localName = entry.localName ? `${entry.localName} as ` : "";

  if (entry.exportKind === "star") {
    return `*${source}`;
  }

  if (entry.exportKind === "namespace") {
    return `* as ${entry.name}${source}`;
  }

  return `${localName}${entry.name}${source}${declaration}`;
}

function formatExportLines(
  label: string,
  marker: "+" | "-",
  entries: readonly PublicApiExport[],
): string[] {
  if (entries.length === 0) {
    return [`- ${label}: none`];
  }

  return [`- ${label}:`, ...entries.map((entry) => `  - \`${marker} ${formatExport(entry)}\``)];
}

function formatTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function formatCoverageCell(coverage: readonly string[]): string {
  return formatTableCell(coverage.join("<br>"));
}

function formatCompatibilityGroupMetadata(group: PublicApiCompatibilityGroup): string {
  return formatTableCell(
    [
      `title=${group.title}`,
      `owner=${group.owner}`,
      `policy=${group.breakingChangePolicy}`,
      `coverage=${group.coverage.join(", ")}`,
    ].join("; "),
  );
}

function formatCompatibilityGroupMetadataDiffLines(
  diff: PublicApiCompatibilityGroupMetadataDiff,
): string[] {
  if (!hasCompatibilityGroupMetadataDiff(diff)) {
    return [];
  }

  const changedLines = diff.changed.map(
    (change) =>
      `| ${formatTableCell(change.groupId)} | changed | ${formatCompatibilityGroupMetadata(
        change.previous,
      )} | ${formatCompatibilityGroupMetadata(change.current)} |`,
  );
  const addedLines = diff.added.map(
    (group) =>
      `| ${formatTableCell(group.id)} | added | none | ${formatCompatibilityGroupMetadata(
        group,
      )} |`,
  );
  const removedLines = diff.removed.map(
    (group) =>
      `| ${formatTableCell(group.id)} | removed | ${formatCompatibilityGroupMetadata(
        group,
      )} | none |`,
  );

  return [
    "",
    "Compatibility group metadata drift:",
    "| Group | Change | Previous | Current |",
    "| --- | --- | --- | --- |",
    ...changedLines,
    ...addedLines,
    ...removedLines,
  ];
}

function formatCompatibilityGroupImpactLines(
  impacts: readonly PublicApiCompatibilityGroupImpact[],
): string[] {
  if (impacts.length === 0) {
    return [];
  }

  return [
    "",
    "Compatibility group impact:",
    "| Group | Owner | Runtime + | Runtime - | Type + | Type - | Breaking-change policy | Coverage |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- | --- |",
    ...impacts.map(
      (impact) =>
        `| ${formatTableCell(`${impact.title} (${impact.id})`)} | ${formatTableCell(
          impact.owner,
        )} | ${impact.runtimeAdded} | ${impact.runtimeRemoved} | ${impact.typeAdded} | ${impact.typeRemoved} | ${formatTableCell(
          impact.breakingChangePolicy,
        )} | ${formatCoverageCell(impact.coverage)} |`,
    ),
  ];
}

export function buildPublicApiReportMarkdown(
  summary: PublicApiSummary,
  diff: PublicApiDiff,
): string {
  const lines = [
    "# Public API Surface Report",
    "",
    `- Status: ${summary.status}`,
    `- Packages scanned: ${summary.packageCount}`,
    `- Packages with API drift: ${summary.changedPackages}`,
    `- Snapshot: \`${summary.snapshotPath}\``,
    `- Update command: \`${summary.updateCommand}\``,
    "- CI guard: `pnpm public-api:check` runs through `pnpm check`.",
    "- Release review: runtime or type export changes in publishable packages must be intentional. Pair the snapshot update with a changeset when the package's public behavior, types, or import surface changes.",
    "",
    "## Diff Totals",
    "| Surface | Added | Removed |",
    "| --- | ---: | ---: |",
    `| runtime exports | ${summary.runtimeAdded} | ${summary.runtimeRemoved} |`,
    `| type exports | ${summary.typeAdded} | ${summary.typeRemoved} |`,
    "",
    "## Package Diffs",
  ];

  if (diff.packages.length === 0) {
    lines.push("- none");
    return `${lines.join("\n")}\n`;
  }

  for (const pkg of diff.packages) {
    lines.push(
      "",
      `### ${pkg.packageName}`,
      `- Path: \`${pkg.relativeDir}\``,
      `- Package status: ${pkg.packageStatus}`,
      ...formatCompatibilityGroupMetadataDiffLines(pkg.compatibilityGroupMetadata),
      ...formatCompatibilityGroupImpactLines(pkg.compatibilityGroupImpacts),
      "",
      "Runtime exports:",
      ...formatExportLines("added", "+", pkg.runtime.added),
      ...formatExportLines("removed", "-", pkg.runtime.removed),
      "",
      "Type exports:",
      ...formatExportLines("added", "+", pkg.type.added),
      ...formatExportLines("removed", "-", pkg.type.removed),
    );
  }

  return `${lines.join("\n")}\n`;
}

function writeJsonFile(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function writePublicApiReport(
  reportDir: string,
  summary: PublicApiSummary,
  diff: PublicApiDiff,
): void {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    join(reportDir, reportFileName),
    buildPublicApiReportMarkdown(summary, diff),
    "utf-8",
  );
  writeJsonFile(join(reportDir, summaryFileName), summary);
}

function parseArgs(args: readonly string[]): CheckOptions {
  let mode: Mode = "check";
  let rootDir = process.cwd();
  let snapshotPath = join(rootDir, snapshotFileName);
  let reportDir = join(rootDir, reportDirectory);

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--check") {
      mode = "check";
      continue;
    }

    if (arg === "--write") {
      mode = "write";
      continue;
    }

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      snapshotPath = join(rootDir, snapshotFileName);
      reportDir = join(rootDir, reportDirectory);
      index++;
      continue;
    }

    if (arg === "--snapshot") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--snapshot requires a path");
      }
      snapshotPath = resolve(value);
      index++;
      continue;
    }

    if (arg === "--report-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--report-dir requires a path");
      }
      reportDir = resolve(value);
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    mode,
    rootDir,
    snapshotPath,
    reportDir,
  };
}

function relativeSnapshotPath(rootDir: string, snapshotPath: string): string {
  return toPosixPath(relative(rootDir, snapshotPath));
}

function relativeReportPath(rootDir: string, reportDir: string): string {
  return toPosixPath(join(relative(rootDir, reportDir), reportFileName));
}

function runCheck(options: CheckOptions): number {
  const previous = readPublicApiSnapshot(options.snapshotPath);
  const current = createPublicApiSnapshot(options.rootDir);
  const baseline = previous ?? { schemaVersion: 1, packages: [] };
  const diff = diffPublicApiSnapshots(baseline, current);
  const summary = summarizePublicApiDiff(
    current,
    diff,
    relativeSnapshotPath(options.rootDir, options.snapshotPath),
    relativeReportPath(options.rootDir, options.reportDir),
  );

  writePublicApiReport(options.reportDir, summary, diff);

  if (!previous) {
    log(
      `public-api-surface: ${summary.snapshotPath} is missing; run \`${summary.updateCommand}\`.`,
    );
    return 1;
  }

  if (summary.status === "fail") {
    log(
      `public-api-surface: snapshot drift detected in ${summary.changedPackages} package(s); see ${summary.reportPath}.`,
    );
    return 1;
  }

  log(`public-api-surface: ${summary.packageCount} package public API snapshot(s) match.`);
  return 0;
}

function runWrite(options: CheckOptions): number {
  const previous = readPublicApiSnapshot(options.snapshotPath) ?? {
    schemaVersion: 1,
    packages: [],
  };
  const current = createPublicApiSnapshot(options.rootDir);
  const diff = diffPublicApiSnapshots(previous, current);
  const summary = summarizePublicApiDiff(
    current,
    diff,
    relativeSnapshotPath(options.rootDir, options.snapshotPath),
    relativeReportPath(options.rootDir, options.reportDir),
  );

  writeJsonFile(options.snapshotPath, current);
  writePublicApiReport(options.reportDir, summary, diff);
  log(`public-api-surface: wrote ${summary.snapshotPath} for ${summary.packageCount} package(s).`);
  return 0;
}

function main(): void {
  try {
    const options = parseArgs(argv.slice(2));
    exit(options.mode === "write" ? runWrite(options) : runCheck(options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`public-api-surface: failed: ${message}`);
    exit(1);
  }
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  main();
}
