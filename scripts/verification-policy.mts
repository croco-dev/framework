import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type VerificationSurface =
  | "root-script"
  | "workflow-command"
  | "package-script"
  | "cli-declaration";

export type VerificationClassification =
  | "repository-guarded"
  | "isolated-generated-project"
  | "generator-regression-tested"
  | "excluded-related-issue";

export type VerificationPath = {
  readonly id: string;
  readonly surface: VerificationSurface;
  readonly path: string;
  readonly name: string;
  readonly command: string;
};

export type VerificationPolicy = {
  readonly classification: VerificationClassification;
  readonly owner: string;
  readonly nonmutationEvidence: string;
  readonly recoveryCommand: string;
};

const ROOT_SCRIPT_RECOVERY = {
  "architecture:check:circular": "Fix the reported circular dependency",
  "architecture:check:circular:allowlist":
    "Update code or intentionally update the circular dependency allowlist",
  "architecture-policy:check": "Fix the reported architecture violation",
  "bench:check": "pnpm bench:update",
  "changeset-required:check": "pnpm changeset or revert the publishable change",
  check: "Use the failing check output to run its explicit writer or fix command",
  "ci-executables:check": "Pin the reported executable to an immutable reviewed source",
  "dependency-boundaries:check": "Fix the reported package boundary",
  "docs:api-triggers:check": "pnpm docs:api-triggers:write",
  "docs:api:check": "pnpm docs:build, format the generated API docs, and commit them",
  "docs:catalog:check": "pnpm docs:catalog:write",
  "docs:examples:check": "pnpm docs:examples:write",
  "first-success:verify": "Follow the reported scaffold or documentation recovery command",
  "generated-secret-placeholders:check": "Fix the reported template placeholder",
  "package-manifests:check": "pnpm package-manifests:write",
  "problem-registry:check": "pnpm problem-registry:write",
  "production-ready:check": "Fix the reported production-ready package violations",
  "provider-certification:check": "Fix the reported provider certification metadata",
  "public-api:check": "pnpm public-api:write",
  "release-docs:check": "Fix the reported release documentation contract",
  "security-allowlists:check": "Fix the reported security allowlist metadata",
  "spine-promotion:check": "Fix the reported beta spine promotion violations",
  "static-misuse:check": "Fix the reported source misuse",
  "strict-contract-typecheck": "Fix the reported strict contract diagnostic",
  typecheck: "Fix the reported TypeScript diagnostics",
  "verify:publish": "Fix the failing publish-profile command",
  "verify:repo": "Fix the failing repository-profile command",
  "verify:spine": "Fix the failing spine-profile command",
  "verification-policy:check": "Guard or classify the reported verification path",
} as const;

export const ROOT_VERIFICATION_POLICY = Object.fromEntries(
  Object.entries(ROOT_SCRIPT_RECOVERY).map(([name, recoveryCommand]) => [
    name,
    {
      classification: "repository-guarded",
      owner: `root package script ${name}`,
      nonmutationEvidence:
        name === "docs:api:check"
          ? "Generation, sanitization, and formatting run in an isolated temporary workspace"
          : name.startsWith("verify:") || name === "check"
            ? "The shared verification manifest guards mutation-prone leaf commands at their authoritative definition"
            : "The authoritative workflow invocation or root audit runs through tracked-files:guard",
      recoveryCommand,
    } satisfies VerificationPolicy,
  ]),
) as Readonly<Record<string, VerificationPolicy>>;

const WORKFLOW_SCRIPT_NAMES = new Set([
  ...Object.keys(ROOT_SCRIPT_RECOVERY),
  "audit:read-only",
  "package-manifests:check",
  "public-api:check",
]);

const TEMPLATE_SCRIPT_NAMES = new Set([
  "architecture-policy:check",
  "build",
  "check",
  "check:write",
  "ci:contracts",
  "contract:check",
  "contract:client",
  "contract:client:check",
  "contract:coverage",
  "contract:openapi",
  "contract:openapi:check",
  "contract:snapshot",
  "contract:verify",
  "demo:smoke",
  "di:check",
  "di:verify",
  "profile:check",
  "project-map:check",
  "runtime-policy:check",
  "typecheck",
]);

const CLI_POLICIES: Readonly<Record<string, VerificationPolicy>> = {
  "packages/cli/src/commands/architecturePolicy.ts:check-subcommand": generatedProjectPolicy(
    "architecture-policy check",
  ),
  "packages/cli/src/commands/contractsCheck.ts:check-subcommand":
    relatedIssuePolicy("contract graph check"),
  "packages/cli/src/commands/diCheck.ts:check-subcommand": generatedProjectPolicy("di check"),
  "packages/cli/src/commands/ops.ts:check-subcommand": generatedProjectPolicy("ops check"),
  "packages/cli/src/commands/projectMap.ts:--check": generatedProjectPolicy("project map --check"),
  "packages/cli/src/commands/runtimePolicy.ts:check-subcommand":
    generatedProjectPolicy("runtime-policy check"),
  "packages/cli/src/commands/upgrade.ts:--dry-run": generatorPolicy(
    "packages/cli/src/tests/upgrade.spec.ts and CLI integration coverage",
  ),
  "packages/migration-runner/src/cli.ts:--dry-run": generatorPolicy(
    "MigrationCommandE2E.spec.ts and transaction harness coverage",
  ),
  "packages/openapi-spec/src/libs/cli.ts:--check": relatedIssuePolicy("OpenAPI --check"),
  "packages/openapi-spec/src/libs/cli.ts:--output-check": outputCheckPolicy("OpenAPI output check"),
  "packages/rpc-codegen/src/libs/cli.ts:--check": relatedIssuePolicy("RPC codegen --check"),
  "packages/rpc-codegen/src/libs/cli.ts:--output-check": outputCheckPolicy(
    "RPC codegen output check",
  ),
};

export function discoverRootVerificationScripts(packageJson: string): VerificationPath[] {
  const parsed = JSON.parse(packageJson) as { readonly scripts?: Readonly<Record<string, string>> };

  return Object.entries(parsed.scripts ?? {})
    .filter(([name]) => isVerificationName(name))
    .map(([name, command]) => ({
      id: `root-script:${name}`,
      surface: "root-script" as const,
      path: "package.json",
      name,
      command,
    }))
    .sort(compareVerificationPaths);
}

export function discoverWorkflowVerificationCommands(
  workflows: Readonly<Record<string, string>>,
): VerificationPath[] {
  const discoveries: VerificationPath[] = [];

  for (const [path, source] of Object.entries(workflows)) {
    const occurrences = new Map<string, number>();
    for (const line of source.split("\n")) {
      const command = extractPnpmCommand(line);
      if (!command) continue;

      const verificationName = getPnpmVerificationName(command);
      if (!verificationName) continue;

      const occurrence = (occurrences.get(verificationName) ?? 0) + 1;
      occurrences.set(verificationName, occurrence);
      discoveries.push({
        id: `workflow-command:${path}:${verificationName}:${occurrence}`,
        surface: "workflow-command",
        path,
        name: verificationName,
        command,
      });
    }
  }

  return discoveries.sort(compareVerificationPaths);
}

export function discoverPackageVerificationScripts(
  manifests: Readonly<Record<string, string>>,
): VerificationPath[] {
  const discoveries: VerificationPath[] = [];

  for (const [path, source] of Object.entries(manifests)) {
    const parsed = JSON.parse(source) as { readonly scripts?: Readonly<Record<string, string>> };
    for (const [name, command] of Object.entries(parsed.scripts ?? {})) {
      if (!isVerificationName(name) && !isVerificationCommand(command)) continue;
      discoveries.push({
        id: `package-script:${path}:${name}`,
        surface: "package-script",
        path,
        name,
        command,
      });
    }
  }

  return discoveries.sort(compareVerificationPaths);
}

export function discoverCliVerificationDeclarations(
  sources: Readonly<Record<string, string>>,
): VerificationPath[] {
  const discoveries: VerificationPath[] = [];

  for (const [path, source] of Object.entries(sources)) {
    const declarations = new Set<string>();
    if (/args\.includes\(["']--check["']\)|\.option\(["']--check["']/.test(source)) {
      declarations.add("--check");
    }
    if (/args\.includes\(["']--dry-run["']\)|\.option\(["']--dry-run["']/.test(source)) {
      declarations.add("--dry-run");
    }
    if (/args\.includes\(["']--output-check["']\)|\.option\(["']--output-check["']/.test(source)) {
      declarations.add("--output-check");
    }
    if (/name:\s*["']check["']/.test(source)) declarations.add("check-subcommand");

    for (const declaration of declarations) {
      discoveries.push({
        id: `cli-declaration:${path}:${declaration}`,
        surface: "cli-declaration",
        path,
        name: declaration,
        command: declaration,
      });
    }
  }

  return discoveries.sort(compareVerificationPaths);
}

export function classifyVerificationPath(path: VerificationPath): VerificationPolicy | undefined {
  if (path.surface === "root-script") return ROOT_VERIFICATION_POLICY[path.name];
  if (path.surface === "workflow-command") {
    if (!WORKFLOW_SCRIPT_NAMES.has(path.name) && path.name !== "publish:--dry-run")
      return undefined;
    if (!isAllowedWorkflowInvocation(path)) return undefined;
    return {
      classification: "repository-guarded",
      owner: `${path.path} workflow invocation`,
      nonmutationEvidence:
        path.name === "publish:--dry-run"
          ? "The package manager publish dry-run performs validation without publishing"
          : "The invocation is guarded at its authoritative site or delegates to audit:read-only",
      recoveryCommand:
        path.name === "publish:--dry-run"
          ? "Fix the reported package publication error"
          : (ROOT_SCRIPT_RECOVERY[path.name as keyof typeof ROOT_SCRIPT_RECOVERY] ??
            "Run the failing command recovery guidance"),
    };
  }
  if (path.surface === "package-script") {
    if (path.path.startsWith("packages/create-croco-app/templates/")) {
      if (!TEMPLATE_SCRIPT_NAMES.has(path.name)) return undefined;
      if (
        [
          "ci:contracts",
          "contract:client:check",
          "contract:openapi:check",
          "contract:verify",
        ].includes(path.name)
      ) {
        return outputCheckPolicy(`generated template script ${path.name}`);
      }
      const excluded = path.name.startsWith("contract:") || path.name === "ci:contracts";
      return excluded
        ? relatedIssuePolicy(`generated template script ${path.name}`)
        : generatedProjectPolicy(`generated template script ${path.name}`);
    }
    if (path.name !== "typecheck") return undefined;
    return {
      classification: "repository-guarded",
      owner: "root Turbo typecheck aggregation",
      nonmutationEvidence: "CI guards the exact Turbo typecheck aggregation over package scripts",
      recoveryCommand: "Fix the reported TypeScript diagnostics",
    };
  }
  return CLI_POLICIES[`${path.path}:${path.name}`];
}

function isAllowedWorkflowInvocation(path: VerificationPath): boolean {
  if (path.name === "publish:--dry-run") return true;
  if (["verify:publish", "verify:repo", "verify:spine"].includes(path.name)) {
    return path.command === `pnpm ${path.name}` || path.command.startsWith(`pnpm ${path.name} `);
  }
  if (["audit:read-only", "docs:api:check", "verification-policy:check"].includes(path.name))
    return path.command === `pnpm ${path.name}`;
  return (
    path.command.startsWith("pnpm tracked-files:guard --recovery ") &&
    /\s--\s+pnpm\s/.test(path.command)
  );
}

export function findUnclassifiedVerificationPaths(
  paths: readonly VerificationPath[],
): VerificationPath[] {
  return paths.filter((path) => !classifyVerificationPath(path));
}

export function discoverRepositoryVerificationPaths(root: string): VerificationPath[] {
  const rootPackagePath = resolve(root, "package.json");
  const workflows = readMatchingFiles(resolve(root, ".github", "workflows"), (name) =>
    /\.ya?ml$/.test(name),
  );
  const packageManifests = readMatchingFiles(resolve(root, "packages"), (name, path) => {
    if (name === "package.json") return !path.includes("/create-croco-app/test-fixtures/");
    return name === "package.json.hbs" && path.includes("/create-croco-app/templates/");
  });
  const cliSources = readMatchingFiles(
    resolve(root, "packages"),
    (name, path) =>
      /\.(?:ts|mts)$/.test(name) && path.includes("/src/") && !/\.(?:spec|test)\.ts$/.test(name),
  );

  return [
    ...discoverRootVerificationScripts(readFileSync(rootPackagePath, "utf-8")),
    ...discoverWorkflowVerificationCommands(relativeRecord(root, workflows)),
    ...discoverPackageVerificationScripts(relativeRecord(root, packageManifests)),
    ...discoverCliVerificationDeclarations(relativeRecord(root, cliSources)),
  ].sort(compareVerificationPaths);
}

function readMatchingFiles(
  directory: string,
  matches: (name: string, normalizedPath: string) => boolean,
): Record<string, string> {
  const files: Record<string, string> = {};
  const pending = [directory];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!["node_modules", "dist", "coverage", ".turbo"].includes(entry.name)) {
          pending.push(resolve(current, entry.name));
        }
        continue;
      }
      if (!entry.isFile()) continue;
      const path = resolve(current, entry.name);
      const normalizedPath = path.replaceAll("\\", "/");
      if (matches(entry.name, normalizedPath)) files[path] = readFileSync(path, "utf-8");
    }
  }
  return files;
}

function relativeRecord(
  root: string,
  files: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, source]) => [
      relative(root, path).replaceAll("\\", "/"),
      source,
    ]),
  );
}

function isVerificationName(name: string): boolean {
  return /check|verify/i.test(name);
}

function isVerificationCommand(command: string): boolean {
  return (
    /(?:^|\s)--(?:check|dry-run)(?:\s|$)/.test(command) ||
    /(?:^|\s)(?:[\w-]+:)*(?:check|verify)(?=\s|$|:)/.test(command)
  );
}

function extractPnpmCommand(line: string): string | undefined {
  const index = line.indexOf("pnpm ");
  if (index === -1) return undefined;
  return line
    .slice(index)
    .trim()
    .replace(/[)'";]+$/, "");
}

function getPnpmVerificationName(command: string): string | undefined {
  if (/\bpnpm\s+-r\s+publish\b.*\s--dry-run\b/.test(command)) return "publish:--dry-run";
  const guardedChild = command.match(/\s--\s+pnpm\s+(?:turbo\s+run\s+)?([^\s]+)/);
  if (guardedChild?.[1] && isVerificationName(guardedChild[1])) return guardedChild[1];
  const direct = command.match(/^pnpm\s+(?:turbo\s+run\s+)?([^\s]+)/);
  if (direct?.[1] && (isVerificationName(direct[1]) || direct[1] === "audit:read-only")) {
    return direct[1];
  }
  return undefined;
}

function generatedProjectPolicy(owner: string): VerificationPolicy {
  return {
    classification: "isolated-generated-project",
    owner,
    nonmutationEvidence:
      "Blocking generated-project smoke commits explicit writer output, then runs verification through tracked-files:guard",
    recoveryCommand: "Fix the reported generated-project contract violation",
  };
}

function generatorPolicy(nonmutationEvidence: string): VerificationPolicy {
  return {
    classification: "generator-regression-tested",
    owner: "generator dry-run implementation",
    nonmutationEvidence,
    recoveryCommand: "Fix the generator before rerunning the dry-run command",
  };
}

function relatedIssuePolicy(owner: string): VerificationPolicy {
  return {
    classification: "excluded-related-issue",
    owner: `#1322 (${owner})`,
    nonmutationEvidence: "Output drift and generated-project isolation are owned by #1322",
    recoveryCommand: "Follow #1322 output regeneration guidance",
  };
}

function outputCheckPolicy(owner: string): VerificationPolicy {
  return {
    classification: "generator-regression-tested",
    owner,
    nonmutationEvidence:
      "OpenAPI Output.spec.ts and RPC codegen.spec.ts assert unchanged checks preserve bytes, mtimes, and directory contents",
    recoveryCommand: "Run the reported regeneration command and commit the generated outputs",
  };
}

function compareVerificationPaths(left: VerificationPath, right: VerificationPath): number {
  return left.id.localeCompare(right.id);
}

export function main(root = process.cwd()): number {
  const unclassified = findUnclassifiedVerificationPaths(discoverRepositoryVerificationPaths(root));
  if (unclassified.length === 0) {
    console.log(
      "verification-policy: every discovered verification path is classified and read-only.",
    );
    return 0;
  }
  console.error("verification-policy: unclassified or unguarded verification paths detected:");
  for (const path of unclassified) console.error(`- ${path.id}: ${path.command}`);
  console.error(
    "Guard the command, make it intrinsically read-only, or add an explicit owned policy.",
  );
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
