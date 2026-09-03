import { spawn as nodeSpawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, extname, isAbsolute, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";

import { Node, Project, SyntaxKind, ts } from "ts-morph";

import type { DesktopContractGraphV1, DesktopContractSemanticHash } from "@croco/protocols-desktop";
import type { Identifier, ImportDeclaration } from "ts-morph";

const WORKER_PROTOCOL_VERSION = "croco.desktop-config-worker.v1";
const CONFIG_VERSION = "croco.desktop-config.v1";
const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"] as const;
const SUPPORTED_EXTERNAL_MODULES = new Set([
  "@croco/problems-core",
  "@croco/protocols-desktop",
  "zod",
  "zod/v4/core",
]);
const NETWORK_GLOBALS = new Set(["EventSource", "WebSocket", "fetch"]);
const TIME_GLOBALS = new Set([
  "AbortSignal",
  "CustomEvent",
  "Date",
  "Event",
  "File",
  "Intl",
  "MessageEvent",
  "Temporal",
  "performance",
  "setImmediate",
  "setInterval",
  "setTimeout",
]);
const DETERMINISTIC_GLOBALS = new Set([
  "Array",
  "ArrayBuffer",
  "BigInt",
  "BigInt64Array",
  "BigUint64Array",
  "Boolean",
  "DataView",
  "Float32Array",
  "Float64Array",
  "Infinity",
  "Int16Array",
  "Int32Array",
  "Int8Array",
  "JSON",
  "Map",
  "NaN",
  "Number",
  "Object",
  "RegExp",
  "Set",
  "String",
  "TextDecoder",
  "TextEncoder",
  "URL",
  "URLSearchParams",
  "Uint16Array",
  "Uint32Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "WeakMap",
  "WeakSet",
  "decodeURI",
  "decodeURIComponent",
  "encodeURI",
  "encodeURIComponent",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt",
  "undefined",
]);
const CONFIG_RECOVERY =
  "Apply each policy finding's source correction, then run the desktop command again.";

export const DESKTOP_CONFIG_POLICY_CODES = {
  filesystem: "CROCO_DESKTOP_CONFIG_FILESYSTEM_DEPENDENCY",
  network: "CROCO_DESKTOP_CONFIG_NETWORK_DEPENDENCY",
  time: "CROCO_DESKTOP_CONFIG_TIME_DEPENDENCY",
  randomness: "CROCO_DESKTOP_CONFIG_RANDOMNESS_DEPENDENCY",
  electron: "CROCO_DESKTOP_CONFIG_ELECTRON_DEPENDENCY",
  applicationBootstrap: "CROCO_DESKTOP_CONFIG_APPLICATION_BOOTSTRAP_DEPENDENCY",
  processEnv: "CROCO_DESKTOP_CONFIG_PROCESS_ENV_DEPENDENCY",
  dynamicImport: "CROCO_DESKTOP_CONFIG_DYNAMIC_IMPORT_DEPENDENCY",
  sideEffectImport: "CROCO_DESKTOP_CONFIG_SIDE_EFFECT_IMPORT",
  implementation: "CROCO_DESKTOP_CONFIG_RUNTIME_IMPLEMENTATION",
  unsupportedPackage: "CROCO_DESKTOP_CONFIG_UNSUPPORTED_PACKAGE",
  unresolvedRelativeImport: "CROCO_DESKTOP_CONFIG_RELATIVE_IMPORT_UNRESOLVED",
} as const;

export type DesktopConfigPolicyCode =
  (typeof DESKTOP_CONFIG_POLICY_CODES)[keyof typeof DESKTOP_CONFIG_POLICY_CODES];

export type DesktopConfigV1<TApp = unknown, TProblemRegistry = unknown> = {
  readonly version: typeof CONFIG_VERSION;
  readonly app: TApp;
  readonly problemRegistries?: readonly TProblemRegistry[];
};

export type DesktopConfigPolicyFinding = {
  readonly code: DesktopConfigPolicyCode;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly dependency: string;
  readonly message: string;
  readonly recovery: string;
};

export type DesktopConfigWorkerRequest = {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly input: string;
};

export type DesktopConfigWorkerExecution = {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly protocol: string;
};

export type DesktopConfigSpawn = (
  request: DesktopConfigWorkerRequest,
) => Promise<DesktopConfigWorkerExecution>;

export type LoadDesktopConfigOptions = {
  readonly configPath: string;
  readonly cwd?: string;
  readonly strict?: boolean;
  readonly workerPath?: string;
  readonly executable?: string;
  readonly spawn?: DesktopConfigSpawn;
};

export type DesktopConfigLoadFailureCode =
  | "CROCO_DESKTOP_CONFIG_POLICY_REJECTED"
  | "CROCO_DESKTOP_CONFIG_WORKER_FAILED"
  | "CROCO_DESKTOP_CONFIG_WORKER_PROTOCOL_INVALID"
  | "CROCO_DESKTOP_CONFIG_UNREADABLE"
  | "CROCO_DESKTOP_CONFIG_INVALID"
  | "CROCO_DESKTOP_CONFIG_NONDETERMINISTIC";

export type DesktopConfigLoadSuccess = {
  readonly ok: true;
  readonly configPath: string;
  readonly graph: DesktopContractGraphV1;
  readonly semanticHash: DesktopContractSemanticHash;
  readonly evaluationCount: 1 | 2;
};

export type DesktopConfigLoadFailure = {
  readonly ok: false;
  readonly code: DesktopConfigLoadFailureCode;
  readonly message: string;
  readonly recovery: string;
  readonly findings?: readonly DesktopConfigPolicyFinding[];
};

export type DesktopConfigLoadResult = DesktopConfigLoadSuccess | DesktopConfigLoadFailure;

type WorkerSuccess = {
  readonly version: typeof WORKER_PROTOCOL_VERSION;
  readonly ok: true;
  readonly graph: DesktopContractGraphV1;
  readonly semanticHash: DesktopContractSemanticHash;
};

type WorkerFailure = {
  readonly version: typeof WORKER_PROTOCOL_VERSION;
  readonly ok: false;
  readonly code: "CROCO_DESKTOP_CONFIG_INVALID";
  readonly message: string;
  readonly recovery: string;
};

type WorkerProtocol = WorkerSuccess | WorkerFailure;

type DesktopConfigBundleModule = {
  readonly path: string;
  readonly source: string;
  readonly dependencies: Readonly<Record<string, string>>;
};

class DesktopConfigBundleError extends Error {
  readonly code = "CROCO_DESKTOP_CONFIG_TRANSPILE_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "DesktopConfigBundleError";
  }
}

export function resolveDesktopConfigPath(configPath: string, cwd = process.cwd()): string {
  if (isAbsolute(configPath)) return resolve(configPath);
  if (isWindowsDrivePath(configPath)) return win32.normalize(configPath);
  return resolve(cwd, configPath);
}

export async function scanDesktopConfigImportPolicy(
  configPath: string,
): Promise<readonly DesktopConfigPolicyFinding[]> {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const pending = [configPath];
  const visited = new Set<string>();
  const findings: DesktopConfigPolicyFinding[] = [];

  while (pending.length > 0) {
    const currentPath = pending.shift();
    if (!currentPath || visited.has(currentPath)) continue;
    visited.add(currentPath);

    const sourceFile = project.addSourceFileAtPath(currentPath);
    for (const declaration of sourceFile.getImportDeclarations()) {
      if (isTypeOnlyImport(declaration)) continue;
      if (!declaration.getImportClause()) {
        findings.push(
          createFinding(
            DESKTOP_CONFIG_POLICY_CODES.sideEffectImport,
            currentPath,
            declaration,
            declaration.getModuleSpecifierValue(),
            "Replace the side-effect import with an explicit definition import in the desktop config module graph.",
          ),
        );
      }
      inspectModuleSpecifier(
        currentPath,
        declaration.getModuleSpecifierValue(),
        declaration.getModuleSpecifier(),
        pending,
        findings,
      );
    }
    for (const declaration of sourceFile.getExportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue();
      if (!specifier || declaration.isTypeOnly()) continue;
      inspectModuleSpecifier(
        currentPath,
        specifier,
        declaration.getModuleSpecifier(),
        pending,
        findings,
      );
    }
    for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.ImportEqualsDeclaration)) {
      if (declaration.isTypeOnly()) continue;
      findings.push(
        createFinding(
          DESKTOP_CONFIG_POLICY_CODES.dynamicImport,
          currentPath,
          declaration,
          declaration.getModuleReference().getText(),
          "Replace import-equals or require syntax with a static ECMAScript import in the desktop config module graph.",
        ),
      );
    }

    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expression = call.getExpression();
      const argument = call.getArguments()[0];
      if (expression.getKind() === SyntaxKind.ImportKeyword) {
        findings.push(
          createFinding(
            DESKTOP_CONFIG_POLICY_CODES.dynamicImport,
            currentPath,
            expression,
            Node.isStringLiteral(argument) ? argument.getLiteralValue() : expression.getText(),
            "Replace dynamic import or require with a static import in the desktop config module graph.",
          ),
        );
      }

      if (Node.isPropertyAccessExpression(expression) && expression.getName() === "implement") {
        findings.push(
          createFinding(
            DESKTOP_CONFIG_POLICY_CODES.implementation,
            currentPath,
            expression,
            expression.getText(),
            "Remove runtime implementations from the desktop config and export only contract definitions.",
          ),
        );
      }
    }

    for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
      inspectAmbientIdentifier(currentPath, identifier, findings);
    }
    for (const access of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
      if (access.getName() === "constructor") {
        findings.push(
          createFinding(
            DESKTOP_CONFIG_POLICY_CODES.dynamicImport,
            currentPath,
            access,
            access.getText(),
            "Remove dynamic constructor access and export only declarative desktop definitions.",
          ),
        );
      }
    }
    for (const access of sourceFile.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)) {
      const argument = access.getArgumentExpression();
      if (Node.isStringLiteral(argument) && argument.getLiteralValue() === "constructor") {
        findings.push(
          createFinding(
            DESKTOP_CONFIG_POLICY_CODES.dynamicImport,
            currentPath,
            access,
            access.getText(),
            "Remove dynamic constructor access and export only declarative desktop definitions.",
          ),
        );
      }
    }
  }

  return findings.sort(compareFindings);
}

export async function loadDesktopConfig(
  options: LoadDesktopConfigOptions,
): Promise<DesktopConfigLoadResult> {
  const configPath = resolveDesktopConfigPath(options.configPath, options.cwd);
  let findings: readonly DesktopConfigPolicyFinding[];
  try {
    findings = await scanDesktopConfigImportPolicy(configPath);
  } catch (error) {
    return {
      ok: false,
      code: "CROCO_DESKTOP_CONFIG_UNREADABLE",
      message: error instanceof Error ? error.message : String(error),
      recovery: `Create a readable desktop config at '${configPath}', then run the command again.`,
    };
  }
  if (findings.length > 0) {
    return {
      ok: false,
      code: "CROCO_DESKTOP_CONFIG_POLICY_REJECTED",
      message: `Desktop config import policy rejected ${findings.length} dependency finding(s).`,
      recovery: CONFIG_RECOVERY,
      findings,
    };
  }

  let bundle: string;
  try {
    bundle = createDesktopConfigBundle(configPath);
  } catch (error) {
    return {
      ok: false,
      code:
        error instanceof DesktopConfigBundleError
          ? "CROCO_DESKTOP_CONFIG_INVALID"
          : "CROCO_DESKTOP_CONFIG_UNREADABLE",
      message: error instanceof Error ? error.message : String(error),
      recovery: `Correct the desktop config module graph rooted at '${configPath}', then run the command again.`,
    };
  }

  const workerPath =
    options.workerPath ?? fileURLToPath(new URL("./desktop-config-worker.js", import.meta.url));
  const spawn = options.spawn ?? spawnDesktopConfigWorker;
  const evaluationCwd = options.cwd ?? process.cwd();
  const first = await evaluateConfig(
    spawn,
    options.executable ?? process.execPath,
    workerPath,
    configPath,
    evaluationCwd,
    bundle,
  );
  if (!first.ok) return first;
  if (!options.strict) {
    return { ...first, configPath, evaluationCount: 1 };
  }

  const second = await evaluateConfig(
    spawn,
    options.executable ?? process.execPath,
    workerPath,
    configPath,
    evaluationCwd,
    bundle,
  );
  if (!second.ok) return second;
  if (first.semanticHash !== second.semanticHash) {
    return {
      ok: false,
      code: "CROCO_DESKTOP_CONFIG_NONDETERMINISTIC",
      message: `Strict desktop config evaluation produced unequal semantic hashes: ${first.semanticHash} and ${second.semanticHash}.`,
      recovery:
        "Remove ambient or mutable inputs from the desktop config, then run the command again.",
    };
  }

  return { ...first, configPath, evaluationCount: 2 };
}

export const spawnDesktopConfigWorker: DesktopConfigSpawn = (request) =>
  new Promise((resolveExecution) => {
    const child = nodeSpawn(request.executable, [...request.args], {
      cwd: request.cwd,
      stdio: ["pipe", "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let protocol = "";

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    const protocolStream = child.stdio[3];
    if (protocolStream && "setEncoding" in protocolStream) protocolStream.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => (stdout += chunk));
    child.stderr?.on("data", (chunk: string) => (stderr += chunk));
    protocolStream?.on("data", (chunk: string) => (protocol += chunk));
    child.stdin?.on("error", (error) => {
      stderr += error.message;
    });
    child.stdin?.end(request.input);
    child.once("error", (error) => {
      stderr += error.message;
    });
    child.once("close", (exitCode, signal) => {
      resolveExecution({ exitCode, signal, stdout, stderr, protocol });
    });
  });

async function evaluateConfig(
  spawn: DesktopConfigSpawn,
  executable: string,
  workerPath: string,
  configPath: string,
  cwd: string,
  bundle: string,
): Promise<DesktopConfigLoadResult> {
  const args = [
    resolveDesktopConfigPermissionFlag(process.versions.node, process.allowedNodeEnvironmentFlags),
    "--allow-fs-read=*",
    "--disallow-code-generation-from-strings",
    workerPath,
    configPath,
  ];
  let execution: DesktopConfigWorkerExecution;
  try {
    execution = await spawn({ executable, args, cwd, input: bundle });
  } catch (error) {
    return workerFailure(error instanceof Error ? error.message : String(error));
  }
  let protocol: WorkerProtocol | null = null;
  let protocolParseFailure: string | null = null;
  try {
    protocol = JSON.parse(execution.protocol) as WorkerProtocol;
  } catch (error) {
    protocolParseFailure = error instanceof Error ? error.message : String(error);
  }
  if (
    protocol?.version === WORKER_PROTOCOL_VERSION &&
    protocol.ok === false &&
    protocol.code === "CROCO_DESKTOP_CONFIG_INVALID"
  ) {
    return {
      ok: false,
      code: protocol.code,
      message: protocol.message,
      recovery: protocol.recovery,
    };
  }
  if (execution.exitCode !== 0) {
    return workerFailure(
      execution.stderr.trim() ||
        `Desktop config worker exited with code ${execution.exitCode ?? "null"}${execution.signal ? ` (${execution.signal})` : ""}.`,
    );
  }
  if (!protocol) {
    return {
      ok: false,
      code: "CROCO_DESKTOP_CONFIG_WORKER_PROTOCOL_INVALID",
      message: `Desktop config worker returned an invalid machine protocol payload: ${protocolParseFailure ?? "empty payload"}.`,
      recovery:
        "Rebuild @croco/cli so the desktop config loader and worker use the same protocol version.",
    };
  }
  if (protocol.version !== WORKER_PROTOCOL_VERSION || typeof protocol.ok !== "boolean") {
    return {
      ok: false,
      code: "CROCO_DESKTOP_CONFIG_WORKER_PROTOCOL_INVALID",
      message: "Desktop config worker returned an unsupported machine protocol payload.",
      recovery:
        "Rebuild @croco/cli so the desktop config loader and worker use the same protocol version.",
    };
  }
  if (!protocol.ok) return protocol;
  if (protocol.graph.semanticHash !== protocol.semanticHash) {
    return {
      ok: false,
      code: "CROCO_DESKTOP_CONFIG_WORKER_PROTOCOL_INVALID",
      message: "Desktop config worker graph hash did not match its protocol hash.",
      recovery: "Rebuild @croco/cli and run the desktop command again.",
    };
  }
  return {
    ok: true,
    configPath,
    graph: protocol.graph,
    semanticHash: protocol.semanticHash,
    evaluationCount: 1,
  };
}

export function resolveDesktopConfigPermissionFlag(
  nodeVersion: string,
  allowedFlags: ReadonlySet<string> | undefined,
): "--experimental-permission" | "--permission" {
  if (allowedFlags?.has("--permission")) return "--permission";
  if (allowedFlags?.has("--experimental-permission")) return "--experimental-permission";

  const [major = 0, minor = 0] = nodeVersion.split(".").map(Number);
  if ((major === 22 && minor < 13) || (major === 23 && minor < 5)) {
    return "--experimental-permission";
  }
  return "--permission";
}

function createDesktopConfigBundle(configPath: string): string {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const pending = [configPath];
  const visited = new Set<string>();
  const modules: DesktopConfigBundleModule[] = [];

  while (pending.length > 0) {
    const currentPath = pending.shift();
    if (!currentPath || visited.has(currentPath)) continue;
    visited.add(currentPath);

    const sourceFile = project.addSourceFileAtPath(currentPath);
    const dependencies: Record<string, string> = {};
    const declarations = [
      ...sourceFile.getImportDeclarations().filter((declaration) => !isTypeOnlyImport(declaration)),
      ...sourceFile
        .getExportDeclarations()
        .filter(
          (declaration) => declaration.getModuleSpecifierValue() && !declaration.isTypeOnly(),
        ),
    ];
    for (const declaration of declarations) {
      const specifier = declaration.getModuleSpecifierValue();
      if (!specifier) continue;
      if (specifier.startsWith(".")) {
        const resolved = resolveRelativeModule(currentPath, specifier);
        if (!resolved) {
          throw new DesktopConfigBundleError(
            `Could not resolve '${specifier}' from '${currentPath}' while compiling the desktop config.`,
          );
        }
        dependencies[specifier] = resolved;
        pending.push(resolved);
      } else {
        dependencies[specifier] = `external:${normalizeDesktopExternalModule(specifier)}`;
      }
    }

    const transpiled = ts.transpileModule(sourceFile.getFullText(), {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: currentPath,
      reportDiagnostics: true,
    });
    const diagnostic = transpiled.diagnostics?.find(
      (candidate) => candidate.category === ts.DiagnosticCategory.Error,
    );
    if (diagnostic) {
      throw new DesktopConfigBundleError(
        `${currentPath}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
      );
    }
    modules.push({ path: currentPath, source: transpiled.outputText, dependencies });
  }

  const factories = modules
    .map(
      (module) =>
        `${JSON.stringify(module.path)}: function (module, exports, require) {\n${module.source}\n}`,
    )
    .join(",\n");
  const dependencies = Object.fromEntries(
    modules.map((module) => [module.path, module.dependencies] as const),
  );
  return `"use strict";
const __desktopFactories = {${factories}};
const __desktopDependencies = ${JSON.stringify(dependencies)};
const __desktopCache = Object.create(null);
class DesktopConfigEvaluationError extends Error {
  code = "CROCO_DESKTOP_CONFIG_EVALUATION_FAILED";
}
function __loadDesktopModule(id) {
  if (Object.hasOwn(__desktopCache, id)) return __desktopCache[id].exports;
  const factory = __desktopFactories[id];
  if (!factory) throw new DesktopConfigEvaluationError(\`Desktop config module '\${id}' is not bundled.\`);
  const module = { exports: {} };
  __desktopCache[id] = module;
  const localRequire = (specifier) => {
    const resolved = __desktopDependencies[id]?.[specifier];
    if (!resolved) throw new DesktopConfigEvaluationError(\`Desktop config dependency '\${specifier}' is not declared by '\${id}'.\`);
    if (resolved.startsWith("external:")) {
      const external = resolved.slice("external:".length);
      const loaded = __desktopExternalModules[external];
      if (!loaded) throw new DesktopConfigEvaluationError(\`Desktop config external module '\${external}' is unavailable.\`);
      return loaded;
    }
    return __loadDesktopModule(resolved);
  };
  factory(module, module.exports, localRequire);
  return module.exports;
}
return __loadDesktopModule(${JSON.stringify(configPath)}).default;
`;
}

function normalizeDesktopExternalModule(specifier: string): string {
  if (SUPPORTED_EXTERNAL_MODULES.has(specifier)) return specifier;
  throw new DesktopConfigBundleError(
    `Desktop config external module '${specifier}' is outside the evaluation allowlist.`,
  );
}

function inspectModuleSpecifier(
  importerPath: string,
  specifier: string,
  node: Node | undefined,
  pending: string[],
  findings: DesktopConfigPolicyFinding[],
): void {
  if (specifier.startsWith(".")) {
    if (isApplicationBootstrapPath(specifier)) {
      findings.push(
        createFinding(
          DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap,
          importerPath,
          node,
          specifier,
        ),
      );
      return;
    }
    const resolved = resolveRelativeModule(importerPath, specifier);
    if (resolved) pending.push(resolved);
    else
      findings.push(
        createFinding(
          DESKTOP_CONFIG_POLICY_CODES.unresolvedRelativeImport,
          importerPath,
          node,
          specifier,
        ),
      );
    return;
  }
  const code = classifyModule(specifier);
  if (code) findings.push(createFinding(code, importerPath, node, specifier));
}

function classifyModule(specifier: string): DesktopConfigPolicyCode | null {
  const normalized = specifier.replace(/^node:/, "");
  if (SUPPORTED_EXTERNAL_MODULES.has(normalized)) return null;
  if (
    normalized.startsWith("@croco/protocols-desktop/") ||
    normalized.startsWith("@croco/problems-core/") ||
    normalized.startsWith("zod/")
  )
    return DESKTOP_CONFIG_POLICY_CODES.unsupportedPackage;
  if (normalized === "fs" || normalized.startsWith("fs/"))
    return DESKTOP_CONFIG_POLICY_CODES.filesystem;
  if (
    ["timers", "perf_hooks"].some(
      (name) => normalized === name || normalized.startsWith(`${name}/`),
    )
  ) {
    return DESKTOP_CONFIG_POLICY_CODES.time;
  }
  if (normalized === "crypto" || normalized.startsWith("crypto/")) {
    return DESKTOP_CONFIG_POLICY_CODES.randomness;
  }
  if (
    ["http", "https", "net", "tls", "dns", "dgram", "undici"].some(
      (name) => normalized === name || normalized.startsWith(`${name}/`),
    )
  ) {
    return DESKTOP_CONFIG_POLICY_CODES.network;
  }
  if (normalized === "electron" || normalized.startsWith("electron/"))
    return DESKTOP_CONFIG_POLICY_CODES.electron;
  if (
    normalized === "@croco/transports-http" ||
    normalized.startsWith("@croco/transports-http/") ||
    normalized === "@croco/meta-vite" ||
    normalized.startsWith("@croco/meta-vite/") ||
    normalized === "@croco/telemetry-sdk-node" ||
    normalized.startsWith("@croco/telemetry-sdk-node/")
  ) {
    return DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap;
  }
  if (normalized.startsWith("@croco/")) {
    return DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap;
  }
  return DESKTOP_CONFIG_POLICY_CODES.unsupportedPackage;
}

function inspectAmbientIdentifier(
  file: string,
  identifier: Identifier,
  findings: DesktopConfigPolicyFinding[],
): void {
  if (!isRuntimeIdentifier(identifier) || !isAmbientIdentifier(identifier)) return;

  const name = identifier.getText();
  const access = readPropertyChain(identifier);
  let code: DesktopConfigPolicyCode | null = null;
  if (name === "process") {
    code = classifyProcessAccess(access);
  } else if (name === "globalThis" || name === "global") {
    code = classifyGlobalAccess(access.segments);
  } else if (NETWORK_GLOBALS.has(name)) {
    code = DESKTOP_CONFIG_POLICY_CODES.network;
  } else if (TIME_GLOBALS.has(name)) {
    code = DESKTOP_CONFIG_POLICY_CODES.time;
  } else if (name === "crypto") {
    code = DESKTOP_CONFIG_POLICY_CODES.randomness;
  } else if (name === "Math") {
    code =
      access.segments.length === 0 || access.segments[0] === null || access.segments[0] === "random"
        ? DESKTOP_CONFIG_POLICY_CODES.randomness
        : null;
  } else if (name === "require" || name === "eval" || name === "Function") {
    code = DESKTOP_CONFIG_POLICY_CODES.dynamicImport;
  } else if (!DETERMINISTIC_GLOBALS.has(name)) {
    code = DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap;
  }

  if (code) findings.push(createFinding(code, file, identifier, access.node.getText()));
}

function classifyProcessAccess(access: PropertyChain): DesktopConfigPolicyCode {
  if (access.segments[0] === "env") return DESKTOP_CONFIG_POLICY_CODES.processEnv;
  if (access.segments[0] !== "getBuiltinModule") {
    return DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap;
  }

  const parent = access.node.getParent();
  if (!parent || !Node.isCallExpression(parent) || parent.getExpression() !== access.node) {
    return DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap;
  }
  const argument = parent.getArguments()[0];
  if (!Node.isStringLiteral(argument)) return DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap;
  return (
    classifyModule(argument.getLiteralValue()) ?? DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap
  );
}

function classifyGlobalAccess(segments: readonly (string | null)[]): DesktopConfigPolicyCode {
  if (segments[0] === "process" && segments[1] === "env") {
    return DESKTOP_CONFIG_POLICY_CODES.processEnv;
  }
  if (NETWORK_GLOBALS.has(segments[0] ?? "")) {
    return DESKTOP_CONFIG_POLICY_CODES.network;
  }
  if (TIME_GLOBALS.has(segments[0] ?? "")) {
    return DESKTOP_CONFIG_POLICY_CODES.time;
  }
  if (segments[0] === "Math" || segments[0] === "crypto") {
    return DESKTOP_CONFIG_POLICY_CODES.randomness;
  }
  return DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap;
}

type PropertyChain = {
  readonly node: Node;
  readonly segments: readonly (string | null)[];
};

function readPropertyChain(identifier: Identifier): PropertyChain {
  const segments: (string | null)[] = [];
  let node: Node = identifier;
  while (true) {
    const parent = node.getParent();
    if (parent && Node.isPropertyAccessExpression(parent) && parent.getExpression() === node) {
      segments.push(parent.getName());
      node = parent;
      continue;
    }
    if (parent && Node.isElementAccessExpression(parent) && parent.getExpression() === node) {
      const argument = parent.getArgumentExpression();
      segments.push(Node.isStringLiteral(argument) ? argument.getLiteralValue() : null);
      node = parent;
      continue;
    }
    return { node, segments };
  }
}

function isAmbientIdentifier(identifier: Identifier): boolean {
  const declarations = identifier.getSymbol()?.getDeclarations();
  return (
    !declarations ||
    declarations.every((declaration) => declaration.getSourceFile().isDeclarationFile())
  );
}

function isRuntimeIdentifier(identifier: Identifier): boolean {
  const parent = identifier.getParent();
  if (!parent) return false;
  if (
    (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === identifier) ||
    (Node.isPropertyAssignment(parent) && parent.getNameNode() === identifier) ||
    Node.isImportSpecifier(parent) ||
    Node.isExportSpecifier(parent)
  ) {
    return false;
  }

  let node: Node | undefined = identifier;
  while (node) {
    if (Node.isTypeNode(node) || Node.isImportDeclaration(node)) return false;
    if (Node.isStatement(node) || Node.isSourceFile(node)) return true;
    node = node.getParent();
  }
  return true;
}

function resolveRelativeModule(importerPath: string, specifier: string): string | null {
  const pathApi = isWindowsDrivePath(importerPath) ? win32 : { dirname, resolve };
  const candidate = pathApi.resolve(pathApi.dirname(importerPath), specifier);
  const extension = extname(candidate);
  const sourceCandidates =
    extension === ".js"
      ? [
          `${candidate.slice(0, -extension.length)}.ts`,
          `${candidate.slice(0, -extension.length)}.tsx`,
        ]
      : extension === ".mjs"
        ? [`${candidate.slice(0, -extension.length)}.mts`]
        : extension === ".cjs"
          ? [`${candidate.slice(0, -extension.length)}.cts`]
          : [];
  const candidates = extension
    ? [candidate, ...sourceCandidates]
    : [
        candidate,
        ...SOURCE_EXTENSIONS.map((extension) => `${candidate}${extension}`),
        ...SOURCE_EXTENSIONS.map((extension) => pathApi.resolve(candidate, `index${extension}`)),
      ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

function isTypeOnlyImport(declaration: ImportDeclaration): boolean {
  const clause = declaration.getImportClause();
  if (!clause) return false;
  if (clause.isTypeOnly()) return true;
  if (clause.getDefaultImport() || clause.getNamespaceImport()) return false;
  const named = declaration.getNamedImports();
  return named.length > 0 && named.every((specifier) => specifier.isTypeOnly());
}

function createFinding(
  code: DesktopConfigPolicyCode,
  file: string,
  node: Node | undefined,
  dependency: string,
  recovery?: string,
): DesktopConfigPolicyFinding {
  const position = node?.getSourceFile().getLineAndColumnAtPos(node.getStart()) ?? {
    line: 1,
    column: 1,
  };
  return {
    code,
    file,
    line: position.line,
    column: position.column,
    dependency,
    message: `Desktop config depends on prohibited ambient input '${dependency}'.`,
    recovery:
      recovery ??
      `Remove '${dependency}' from '${file}' and derive the value in application runtime code instead.`,
  };
}

function isApplicationBootstrapPath(specifier: string): boolean {
  return specifier
    .split(/[\\/]/)
    .some((segment) => /^(?:bootstrap|main|server|startup)(?:\.[^.]+)?$/i.test(segment));
}

function isWindowsDrivePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path);
}

function compareFindings(
  left: DesktopConfigPolicyFinding,
  right: DesktopConfigPolicyFinding,
): number {
  return (
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.column - right.column ||
    left.code.localeCompare(right.code)
  );
}

function workerFailure(message: string): DesktopConfigLoadFailure {
  return {
    ok: false,
    code: "CROCO_DESKTOP_CONFIG_WORKER_FAILED",
    message,
    recovery: "Fix the desktop config evaluation failure, then run the command again.",
  };
}
