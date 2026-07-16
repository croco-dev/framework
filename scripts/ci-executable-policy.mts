#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export const CI_EXECUTABLE_POLICY_RULE_ID = "ci-executable-immutability";
export const CI_EXECUTABLE_POLICY_CODE = "CROCO_CI_EXECUTABLE_IMMUTABILITY";
export const DEFAULT_CI_EXECUTABLE_POLICY_PATHS = [
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  "package.json",
  "scripts",
] as const;

export type CiExecutablePolicyFindingKind =
  | "ad-hoc-package-execution"
  | "mutable-container-reference"
  | "mutable-download-reference"
  | "remote-shell-installer"
  | "unchecked-executable-download";

export type CiExecutablePolicyFinding = {
  readonly code: typeof CI_EXECUTABLE_POLICY_CODE;
  readonly evidence: string;
  readonly file: string;
  readonly kind: CiExecutablePolicyFindingKind;
  readonly line: number;
  readonly message: string;
  readonly recovery: string;
  readonly ruleId: typeof CI_EXECUTABLE_POLICY_RULE_ID;
};

export type CiExecutablePolicyResult = {
  readonly checkedPaths: readonly string[];
  readonly findings: readonly CiExecutablePolicyFinding[];
  readonly ok: boolean;
};

export type CiExecutablePolicyOptions = {
  readonly checkedPaths?: readonly string[];
  readonly rootDir: string;
};

type CommandUnit = {
  readonly file: string;
  readonly line: number;
  readonly text: string;
};

type RootPackage = {
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly scripts?: Readonly<Record<string, string>>;
};

const ignoredScriptDirectories = new Set(["fixtures", "node_modules", "templates", "tests"]);
const astScriptExtensions = new Set([".cjs", ".js", ".mjs", ".mts", ".ts"]);
const scriptExtensions = new Set([...astScriptExtensions, ".sh"]);
const processLaunchFunctions = new Set([
  "exec",
  "execFile",
  "execFileSync",
  "execSync",
  "spawn",
  "spawnSync",
]);
const dockerRunOptionsWithValues = new Set([
  "--add-host",
  "--device",
  "--entrypoint",
  "--env",
  "--env-file",
  "--hostname",
  "--label",
  "--mount",
  "--name",
  "--network",
  "--platform",
  "--publish",
  "--pull",
  "--user",
  "--volume",
  "--workdir",
  "-e",
  "-h",
  "-l",
  "-p",
  "-u",
  "-v",
  "-w",
]);
const packageBinaryAliases: Readonly<Record<string, string>> = {
  changeset: "@changesets/cli",
};
const taggedDigestPattern = /(?:^|\/)[^/@\s]+:[^/@\s]+@sha256:[a-f0-9]{64}\b/i;
const executableDownloadPattern =
  /(?:\/releases\/download\/|\.(?:AppImage|bin|bz2|exe|gz|msi|sh|tar|tgz|xz|zip)(?:[?#\s]|$))/i;
const verificationPattern =
  /(?:sha256sum\s+(?:--check|-c)|shasum\s+-a\s+256\s+(?:--check|-c)|openssl\s+dgst\s+-sha256\s+-verify|cosign\s+verify|gpg\s+--verify|minisign\s+-V)/i;

function toPosixPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function finding(
  unit: CommandUnit,
  kind: CiExecutablePolicyFindingKind,
  message: string,
  recovery: string,
  evidenceOffset = 0,
): CiExecutablePolicyFinding {
  return {
    code: CI_EXECUTABLE_POLICY_CODE,
    evidence: unit.text.trim().replace(/\s+/g, " "),
    file: unit.file,
    kind,
    line: unit.line + unit.text.slice(0, evidenceOffset).split(/\r?\n/).length - 1,
    message,
    recovery,
    ruleId: CI_EXECUTABLE_POLICY_RULE_ID,
  };
}

function workflowCommandUnits(file: string, source: string): CommandUnit[] {
  const lines = source.split(/\r?\n/);
  const units: CommandUnit[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (/^\s*uses\s*:/.test(line) || /^\s*runs-on\s*:/.test(line)) {
      continue;
    }

    const run = line.match(/^(\s*)(?:-\s+)?run\s*:\s*(.*)$/);
    const image = line.match(/^\s*(?:container\s*:\s*(\S.*)|image\s*:\s*(\S.*))$/);
    if (image) {
      units.push({ file, line: index + 1, text: `docker run ${image[1] ?? image[2]}` });
      continue;
    }
    if (!run) {
      continue;
    }

    const inline = run[2] ?? "";
    if (inline !== "|" && inline !== ">" && !inline.startsWith("|-") && !inline.startsWith(">-")) {
      units.push({ file, line: index + 1, text: inline });
      continue;
    }

    const indentation = run[1]?.length ?? 0;
    const block: string[] = [];
    const firstLine = index + 2;
    while (index + 1 < lines.length) {
      const next = lines[index + 1] ?? "";
      const nextIndentation = next.match(/^\s*/)?.[0].length ?? 0;
      if (next.trim() && nextIndentation <= indentation) {
        break;
      }
      block.push(next);
      index++;
    }
    units.push({
      file,
      line: firstLine,
      text: inline.startsWith(">") ? block.join(" ") : block.join("\n"),
    });
  }

  return units;
}

function packageScriptUnits(file: string, source: string, rootPackage: RootPackage): CommandUnit[] {
  return Object.entries(rootPackage.scripts ?? {}).map(([name, text]) => {
    const key = `"${name}"`;
    const offset = source.indexOf(key);
    return { file, line: offset < 0 ? 1 : lineAt(source, offset), text };
  });
}

function literalText(
  node: ts.Expression | undefined,
  bindings: ReadonlyMap<string, string> = new Map(),
): string | null {
  if (!node) {
    return null;
  }
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isArrayLiteralExpression(node)) {
    const values = node.elements.map((element) =>
      ts.isStringLiteralLike(element) || ts.isNoSubstitutionTemplateLiteral(element)
        ? element.text
        : null,
    );
    return values.every((value) => value !== null) ? values.join(" ") : null;
  }
  if (ts.isIdentifier(node)) {
    return bindings.get(node.text) ?? null;
  }
  return null;
}

function scriptCommandUnits(file: string, source: string): CommandUnit[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const units: CommandUnit[] = [];
  const bindings = new Map<string, string>();
  const launchFunctions = new Set(processLaunchFunctions);

  function collectBindings(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const value = literalText(node.initializer, bindings);
      if (value !== null) {
        bindings.set(node.name.text, value);
      }
    }
    ts.forEachChild(node, collectBindings);
  }

  collectBindings(sourceFile);

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "node:child_process" &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      for (const element of statement.importClause.namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        if (processLaunchFunctions.has(importedName)) {
          launchFunctions.add(element.name.text);
        }
      }
    }
  }
  function collectCommonJsLaunchAliases(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "require" &&
      literalText(node.initializer.arguments[0]) === "node:child_process"
    ) {
      for (const element of node.name.elements) {
        const importedName =
          element.propertyName?.getText(sourceFile) ?? element.name.getText(sourceFile);
        if (processLaunchFunctions.has(importedName)) {
          launchFunctions.add(element.name.getText(sourceFile));
        }
      }
    }
    ts.forEachChild(node, collectCommonJsLaunchAliases);
  }

  collectCommonJsLaunchAliases(sourceFile);

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callee = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : null;
      if (callee && launchFunctions.has(callee)) {
        const command = literalText(node.arguments[0], bindings);
        const args = literalText(node.arguments[1], bindings);
        if (command) {
          units.push({
            file,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            text: args ? `${command} ${args}` : command,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return units;
}

function listScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) {
      return [];
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredScriptDirectories.has(entry.name) ? [] : listScriptFiles(path);
    }
    return entry.isFile() && scriptExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

function readRootPackage(rootDir: string): RootPackage {
  const path = join(rootDir, "package.json");
  if (!existsSync(path)) {
    return {};
  }
  return JSON.parse(readFileSync(path, "utf-8")) as RootPackage;
}

function hasLockfileEvidence(rootDir: string, packageName: string, version: string): boolean {
  const lockfilePath = join(rootDir, "pnpm-lock.yaml");
  if (!existsSync(lockfilePath)) {
    return false;
  }
  const lockfile = readFileSync(lockfilePath, "utf-8");
  const rootImporter = /(?:^|\n)  \.:\s*\n([\s\S]*?)(?=\n  \S[^\n]*:\s*\n|\npackages:\s*\n|$)/.exec(
    lockfile,
  )?.[1];
  if (!rootImporter) {
    return false;
  }
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:^|\\n)\\s{6}(?:['"]?${escapedName}['"]?):\\s*\\n\\s{8}specifier:\\s*['"]?${escapedVersion}['"]?(?:\\s|$)`,
  ).test(rootImporter);
}

function isLockfileBackedPnpmExec(
  rootDir: string,
  command: string,
  rootPackage: RootPackage,
): boolean {
  const packageName = packageBinaryAliases[command] ?? command;
  const specifier = rootPackage.devDependencies?.[packageName];
  return Boolean(specifier && hasLockfileEvidence(rootDir, packageName, specifier));
}

function packageExecutionFindings(
  unit: CommandUnit,
  rootDir: string,
  rootPackage: RootPackage,
): CiExecutablePolicyFinding[] {
  const findings: CiExecutablePolicyFinding[] = [];
  const adHoc = unit.text.match(
    /(?:^|[;&|()\s])(npx|npm\s+exec|pnpm\s+dlx|yarn\s+dlx|bunx)(?:\s|$)/i,
  );
  if (adHoc) {
    findings.push(
      finding(
        unit,
        "ad-hoc-package-execution",
        `${adHoc[1]} can resolve and execute a package outside the frozen workspace lockfile.`,
        "Declare the tool as a reviewed root devDependency, commit its pnpm lockfile resolution, and execute it with pnpm exec.",
        (adHoc.index ?? 0) + adHoc[0].indexOf(adHoc[1] ?? ""),
      ),
    );
  }

  const pnpmExecPattern = /\bpnpm(?:\s+(?:--[\w-]+(?:=\S+|\s+\S+)?))*\s+exec\s+([^\s;&|]+)/gi;
  for (const pnpmExec of unit.text.matchAll(pnpmExecPattern)) {
    const command = pnpmExec[1]?.replace(/^['"]|['"]$/g, "");
    if (command && !isLockfileBackedPnpmExec(rootDir, command, rootPackage)) {
      findings.push(
        finding(
          unit,
          "ad-hoc-package-execution",
          `pnpm exec ${command} is not backed by a reviewed root devDependency and matching pnpm lockfile importer entry.`,
          `Declare the package providing ${command} in root devDependencies and refresh pnpm-lock.yaml before executing it in a blocking path.`,
          pnpmExec.index ?? 0,
        ),
      );
    }
  }
  return findings;
}

function containerFindings(unit: CommandUnit): CiExecutablePolicyFinding[] {
  const findings: CiExecutablePolicyFinding[] = [];
  const lines = unit.text.split(/\r?\n/);
  for (const [lineIndex, line] of lines.entries()) {
    for (const invocation of line.matchAll(/\bdocker\s+(run|pull|image\s+pull)\s+([^;&|]+)/gi)) {
      const tokens = invocation[2]?.match(/"[^"]*"|'[^']*'|[^\s;&|]+/g) ?? [];
      let reference = "";
      for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index] ?? "";
        if (token.startsWith("-")) {
          if (!token.includes("=") && dockerRunOptionsWithValues.has(token)) {
            index++;
          }
          continue;
        }
        reference = token;
        break;
      }
      if (reference && !taggedDigestPattern.test(reference)) {
        findings.push(
          finding(
            unit,
            "mutable-container-reference",
            `Container image ${reference} must retain a readable tag and be pinned to an OCI digest.`,
            "Pin the readable image tag together with its immutable digest, for example tool:v1.2.3@sha256:<64-hex-digest>, and retain version context beside the pin.",
            lines.slice(0, lineIndex).join("\n").length +
              (lineIndex > 0 ? 1 : 0) +
              (invocation.index ?? 0),
          ),
        );
      }
    }
  }
  return findings;
}

function shellCommandSegment(text: string, offset: number): string {
  const separators = [...text.matchAll(/&&|\|\||;|\r?\n/g)];
  let start = 0;
  let end = text.length;
  for (const separator of separators) {
    const index = separator.index ?? 0;
    if (index < offset) {
      start = index + separator[0].length;
    } else {
      end = index;
      break;
    }
  }
  return text.slice(start, end);
}

function downloadArtifactName(text: string, url: string, urlOffset: number): string | null {
  const command = shellCommandSegment(text, urlOffset);
  const tokens = command.match(/"[^"]*"|'[^']*'|[^\s;&|]+/g) ?? [];
  const commandIndex = tokens.findIndex((token) => /^(?:curl|wget)$/.test(token));
  for (let index = commandIndex + 1; index < tokens.length; index++) {
    const token = tokens[index] ?? "";
    if (token === "-o" || token === "--output" || token === "-O" || /-[^-]*o$/.test(token)) {
      const output = tokens[index + 1]?.replace(/^['"]|['"]$/g, "");
      if (output && !/^https?:\/\//.test(output)) {
        return output.split("/").at(-1) ?? null;
      }
    }
    const attachedOutput = token.match(/^(?:--output=|-o)(.+)$/)?.[1];
    if (attachedOutput) {
      return (
        attachedOutput
          .replace(/^['"]|['"]$/g, "")
          .split("/")
          .at(-1) ?? null
      );
    }
  }
  try {
    return new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? null;
  } catch {
    return null;
  }
}

function hasExplicitDownloadOutput(text: string, urlOffset: number): boolean {
  const command = shellCommandSegment(text, urlOffset);
  const tokens = command.match(/"[^"]*"|'[^']*'|[^\s;&|]+/g) ?? [];
  return tokens.some(
    (token) =>
      token === "-o" ||
      token === "--output" ||
      token === "-O" ||
      /^--output=.+/.test(token) ||
      /^-[oO].+/.test(token) ||
      /^-[^-]*o$/.test(token),
  );
}

function verificationCoversArtifact(text: string, artifactName: string, rootDir: string): boolean {
  const escapedArtifact = artifactName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const artifactToken = new RegExp(`(?:^|[\\s'"])(?:[^\\s'"]*/)?${escapedArtifact}(?=$|[\\s'"])`);
  const checksumEntry = new RegExp(
    `\\b[a-f0-9]{64}\\s+\\*?(?:[^\\s'"]*/)?${escapedArtifact}(?=$|[\\s'"])`,
    "i",
  );
  for (const segment of text.split(/&&|\|\||;|\r?\n/)) {
    const verifier = verificationPattern.exec(segment);
    if (verifier && /\b(?:sha256sum|shasum)\b/.test(verifier[0])) {
      const manifest = segment
        .slice((verifier.index ?? 0) + verifier[0].length)
        .trim()
        .split(/\s+/)[0]
        ?.replace(/^['"]|['"]$/g, "");
      if (manifest === "-") {
        const pipeInput = segment.slice(0, verifier.index ?? 0);
        if (checksumEntry.test(pipeInput)) {
          return true;
        }
      } else if (manifest) {
        const manifestPath = resolve(rootDir, manifest);
        if (
          manifestPath.startsWith(`${rootDir}/`) &&
          existsSync(manifestPath) &&
          checksumEntry.test(readFileSync(manifestPath, "utf-8"))
        ) {
          return true;
        }
      }
    } else if (verifier && artifactToken.test(segment)) {
      return true;
    }
    const consumesArtifact =
      artifactToken.test(segment) &&
      /(?:^|\s)(?:\.\/|(?:bash|chmod|dash|ksh|node|perl|python\d*|ruby|sh|source|tar|unzip|zsh)\b)/.test(
        segment,
      );
    if (consumesArtifact) {
      return false;
    }
  }
  return false;
}

function downloadFindings(unit: CommandUnit, rootDir: string): CiExecutablePolicyFinding[] {
  const findings: CiExecutablePolicyFinding[] = [];
  const pipe = unit.text.match(
    /\b(?:curl|wget)\b[^\n|]*\|\s*(?:(?:command|sudo)\s+)*(?:(?:\/usr\/bin\/)?env\s+(?:-\S+\s+)*)?(?:\/(?:[\w.-]+\/)+)?(?:bash|dash|ksh|sh|zsh|python\d*|node|perl|ruby)\b/i,
  );
  if (pipe) {
    findings.push(
      finding(
        unit,
        "remote-shell-installer",
        "A remote response is piped directly to a shell.",
        "Download a version-bounded artifact, verify its committed checksum or trusted signature, then execute the verified local file.",
        pipe.index ?? 0,
      ),
    );
    return findings;
  }

  const urls = unit.text.matchAll(/https?:\/\/[^\s'"`)]+/gi);
  for (const urlMatch of urls) {
    const url = urlMatch[0];
    const urlOffset = urlMatch.index ?? 0;
    if (!/\b(?:curl|wget)\b/.test(shellCommandSegment(unit.text, urlOffset))) {
      continue;
    }
    const artifactName = downloadArtifactName(unit.text, url, urlOffset);
    if (!executableDownloadPattern.test(url) && !hasExplicitDownloadOutput(unit.text, urlOffset)) {
      continue;
    }
    if (
      /\/(?:latest|main|master|trunk)(?:\/|\b)|\/releases\/latest\b|\/refs\/heads\/|\/[a-f0-9]{7,39}(?:\/|\b)/i.test(
        url,
      )
    ) {
      findings.push(
        finding(
          unit,
          "mutable-download-reference",
          `Executable download URL uses a latest, branch, or short-SHA reference: ${url}`,
          "Use a release version or full 40-character commit SHA and keep the immutable reference visible in the repository diff.",
          urlMatch.index ?? 0,
        ),
      );
    }
    const verificationText = unit.text.slice(urlOffset + url.length);
    const hasArtifactVerification = Boolean(
      artifactName && verificationCoversArtifact(verificationText, artifactName, rootDir),
    );
    if (!hasArtifactVerification) {
      findings.push(
        finding(
          unit,
          "unchecked-executable-download",
          `Downloaded executable or archive is not checksum- or signature-verified: ${url}`,
          "Verify a checked-in SHA-256 checksum or a trusted signature in the same bounded execution step before unpacking or executing the artifact.",
          urlMatch.index ?? 0,
        ),
      );
    }
  }
  return findings;
}

function scanUnit(
  unit: CommandUnit,
  rootDir: string,
  rootPackage: RootPackage,
): CiExecutablePolicyFinding[] {
  const normalizedUnit = { ...unit, text: unit.text.replace(/\\\r?\n\s*/g, " ") };
  return [
    ...containerFindings(normalizedUnit),
    ...packageExecutionFindings(normalizedUnit, rootDir, rootPackage),
    ...downloadFindings(normalizedUnit, rootDir),
  ];
}

export function runCiExecutablePolicy(
  options: CiExecutablePolicyOptions,
): CiExecutablePolicyResult {
  const rootDir = resolve(options.rootDir);
  const checkedPaths = options.checkedPaths ?? DEFAULT_CI_EXECUTABLE_POLICY_PATHS;
  const rootPackage = readRootPackage(rootDir);
  const units: CommandUnit[] = [];

  for (const checkedPath of checkedPaths) {
    const absolutePath = resolve(rootDir, checkedPath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    if (statSync(absolutePath).isDirectory()) {
      for (const scriptPath of listScriptFiles(absolutePath)) {
        const file = toPosixPath(relative(rootDir, scriptPath));
        const source = readFileSync(scriptPath, "utf-8");
        units.push(
          ...(astScriptExtensions.has(extname(file))
            ? scriptCommandUnits(file, source)
            : [{ file, line: 1, text: source }]),
        );
      }
      continue;
    }

    const file = toPosixPath(relative(rootDir, absolutePath));
    const source = readFileSync(absolutePath, "utf-8");
    if (file === "package.json") {
      units.push(...packageScriptUnits(file, source, rootPackage));
    } else if (/\.ya?ml$/i.test(file)) {
      units.push(...workflowCommandUnits(file, source));
    } else if (scriptExtensions.has(extname(file))) {
      units.push(...scriptCommandUnits(file, source));
    }
  }

  const findings = units.flatMap((unit) => scanUnit(unit, rootDir, rootPackage));
  return { checkedPaths, findings, ok: findings.length === 0 };
}

function parseArgs(args: readonly string[]): CiExecutablePolicyOptions {
  let rootDir = process.cwd();
  const checkedPaths: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--root" || arg === "--path") {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      if (arg === "--root") {
        rootDir = value;
      } else {
        checkedPaths.push(value);
      }
      index++;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return { checkedPaths: checkedPaths.length > 0 ? checkedPaths : undefined, rootDir };
}

function main(): void {
  const result = runCiExecutablePolicy(parseArgs(process.argv.slice(2)));
  for (const item of result.findings) {
    console.error(`${item.file}:${item.line}: ${item.code} [${item.kind}] ${item.message}`);
    console.error(`  evidence: ${item.evidence}`);
    console.error(`  recovery: ${item.recovery}`);
  }
  if (!result.ok) {
    console.error(`ci-executable-policy: failed with ${result.findings.length} finding(s)`);
    process.exit(1);
  }
  console.log(`ci-executable-policy: passed (${result.checkedPaths.length} checked surfaces)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
