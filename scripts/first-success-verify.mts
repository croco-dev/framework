/**
 * first-success-verify.mts
 *
 * Verifies the first-success journey contract by parsing source files.
 * Ensures README documentation, source code, docs, and scaffold stay in sync.
 *
 * Usage: pnpm first-success:verify
 * Exit: 0 = all contracts pass, 1 = any contract fails
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type * as CreateCrocoAppVerification from "../packages/create-croco-app/src/verification.ts";
import { validateGeneratedSaasDocsContract } from "./first-success-generated-contract.mts";
import { getVerificationCommand } from "./verification-manifest.mts";

const scriptRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliContractBundle = join(
  scriptRepoRoot,
  "packages",
  "create-croco-app",
  "dist",
  "verification.js",
);

if (!existsSync(cliContractBundle)) {
  throw new Error(
    `Missing create-croco-app verification contract: ${cliContractBundle}. Run pnpm first-success:verify so the CLI contract is built first.`,
  );
}

const {
  createCreateCrocoAppProgram,
  generate,
  isNonInteractiveOptions,
  normalizeNonInteractiveOptions,
  parseCliOptions,
} = (await import(pathToFileURL(cliContractBundle).href)) as typeof CreateCrocoAppVerification;

// ── Helpers ──────────────────────────────────────────────────────────────────

let failed = false;

type PublicDocsSource = {
  readonly label: string;
  readonly content: string;
  readonly requireSkipFlags?: boolean;
};

type ExtractedCommand = {
  readonly command: string;
  readonly line: number;
};

type PublicCreateCommandValidation = {
  readonly failures: string[];
  readonly isCanonical: boolean;
  readonly line: number;
  readonly resolvedJourney: string | undefined;
};

type RootReadmeToolingCommand = {
  readonly command: string;
  readonly line: number;
  readonly scriptName: string;
};

type PackageJsonWithScripts = {
  readonly scripts?: Record<string, string | undefined>;
};

type PackageCatalog = {
  readonly maturity?: unknown;
  readonly spine?: unknown;
};

type SpineStatusCounts = {
  readonly alpha: number;
  readonly beta: number;
  readonly betaPromotionRecords: number;
  readonly deprecated: number;
  readonly production: number;
  readonly total: number;
};

const requiredRootReadmeScriptNames = [
  "build",
  "lint",
  "format",
  "check",
  "docs:catalog:check",
  "first-success:verify",
  "release-docs:check",
  "release:spine-evidence",
  "test",
  "typecheck",
] as const;

const allowedRootReadmeNonScriptCommands = new Set(["install"]);
const rootReadmeReadinessHeading = "## 🗺️ 로드맵 — 1.0 readiness status";
const rootReadmeToolingHeading = "### 주요 명령어";

const firstSuccessCommandContracts = [
  {
    command: "pnpm quick-start-lambda:smoke",
    scriptName: "quick-start-lambda:smoke",
  },
  {
    command: "pnpm saas-billing-golden-path:smoke",
    scriptName: "saas-billing-golden-path:smoke",
  },
  {
    command: "pnpm first-success:verify",
    scriptName: "first-success:verify",
  },
] as const;

function pass(label: string, detail?: string): void {
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label: string, detail: string): void {
  console.log(`  ❌ ${label}: ${detail}`);
  failed = true;
}

function read(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    fail("File read error", `${path}: ${message}`);
    return "";
  }
}

function runsVerificationScript(
  rootScript: string,
  commandId: string,
  scriptPath: string,
): boolean {
  if (rootScript.includes(scriptPath)) return true;
  const match =
    /^node --experimental-strip-types scripts\/verification-command\.mts --id ([\w-]+)$/.exec(
      rootScript,
    );
  if (match?.[1] !== commandId) return false;
  return getVerificationCommand(commandId).command.includes(scriptPath);
}

function readRootArg(): string {
  const rootIndex = process.argv.indexOf("--root");

  if (rootIndex === -1) {
    return process.cwd();
  }

  const root = process.argv[rootIndex + 1];

  if (!root) {
    fail("Argument error", "--root requires a path");
    return process.cwd();
  }

  return resolve(root);
}

function normalizeMarkdownShellLine(line: string): string {
  return line.trim().replace(/^>\s?/, "").trim();
}

function extractMarkdownSection(
  content: string,
  heading: string,
  boundaryPattern: RegExp,
): string | undefined {
  const startIndex = content.indexOf(heading);
  if (startIndex === -1) {
    return undefined;
  }

  const body = content.slice(startIndex + heading.length);
  const boundaryIndex = body.search(boundaryPattern);

  return boundaryIndex === -1 ? body : body.slice(0, boundaryIndex);
}

function extractFirstMarkdownFence(section: string): string | undefined {
  return /```(?:bash|sh|shell)?\r?\n([\s\S]*?)\r?\n```/.exec(section)?.[1];
}

function stripInlineShellComment(command: string): string {
  const [beforeComment] = command.split("#", 1);

  return beforeComment.trim();
}

function parseRootPnpmCommandName(command: string): string | undefined {
  const args = splitShellWords(command);

  if (args[0] !== "pnpm") {
    return undefined;
  }

  if (args[1] === "run") {
    return args[2];
  }

  return args[1];
}

function extractRootReadmeToolingCommands(rootReadme: string): {
  readonly commands: readonly RootReadmeToolingCommand[];
  readonly failures: readonly string[];
} {
  const toolingSection = extractMarkdownSection(rootReadme, rootReadmeToolingHeading, /\n#{1,3}\s/);
  if (!toolingSection) {
    return {
      commands: [],
      failures: [`README.md missing ${rootReadmeToolingHeading} section`],
    };
  }

  const toolingFence = extractFirstMarkdownFence(toolingSection);
  if (!toolingFence) {
    return {
      commands: [],
      failures: [`README.md ${rootReadmeToolingHeading} section missing a shell command block`],
    };
  }

  const commands: RootReadmeToolingCommand[] = [];
  for (const [index, rawLine] of toolingFence.split(/\r?\n/).entries()) {
    const line = normalizeMarkdownShellLine(rawLine);
    if (!line.startsWith("pnpm ")) {
      continue;
    }

    const command = stripInlineShellComment(line);
    const scriptName = parseRootPnpmCommandName(command);
    if (scriptName) {
      commands.push({ command, line: index + 1, scriptName });
    }
  }

  return { commands, failures: [] };
}

function validateRootReadmeTooling(
  rootReadme: string,
  rootPackageJson: PackageJsonWithScripts,
): string[] {
  const extraction = extractRootReadmeToolingCommands(rootReadme);
  const failures = [...extraction.failures];
  const documentedScriptNames = new Set(extraction.commands.map((command) => command.scriptName));

  for (const scriptName of requiredRootReadmeScriptNames) {
    if (!rootPackageJson.scripts?.[scriptName]) {
      failures.push(`root package.json missing required script \`${scriptName}\``);
      continue;
    }

    if (!documentedScriptNames.has(scriptName)) {
      failures.push(
        `README.md missing root tooling command \`pnpm ${scriptName}\` in ${rootReadmeToolingHeading}`,
      );
    }
  }

  for (const command of extraction.commands) {
    if (allowedRootReadmeNonScriptCommands.has(command.scriptName)) {
      continue;
    }

    if (!rootPackageJson.scripts?.[command.scriptName]) {
      failures.push(
        `README.md documents unknown root tooling command \`${command.command}\` in ${rootReadmeToolingHeading}`,
      );
    }
  }

  return failures;
}

function extractCreateCrocoAppCommands(content: string): ExtractedCommand[] {
  const commands: ExtractedCommand[] = [];
  const lines = content.split(/\r?\n/);
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    let line = normalizeMarkdownShellLine(rawLine ?? "");

    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      if (isCreateCrocoAppCommandSnippet(line)) {
        const commandLine = index + 1;
        while (line.endsWith("\\") && index + 1 < lines.length) {
          index += 1;
          const continuation = normalizeMarkdownShellLine(lines[index] ?? "");
          line = `${line.slice(0, -1).trimEnd()} ${continuation.trim()}`;
        }
        commands.push({ command: line, line: commandLine });
      }
      continue;
    }

    for (const match of line.matchAll(/`([^`]*create-croco-app[^`]*)`/g)) {
      const command = match[1];
      if (isCreateCrocoAppCommandSnippet(command)) {
        commands.push({ command, line: index + 1 });
      }
    }
  }

  return commands;
}

function isCreateCrocoAppCommandSnippet(snippet: string): boolean {
  const cliArgs = extractCreateCrocoAppArgs(splitShellWords(snippet));

  return cliArgs !== undefined && cliArgs.length > 0;
}

function splitShellWords(command: string): string[] {
  const words: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaped = false;

  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        words.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    words.push(current);
  }

  return words;
}

function extractCreateCrocoAppArgs(args: readonly string[]): string[] | undefined {
  const commandBoundary = args.findIndex((arg) => arg === "&&" || arg === ";");
  const commandArgs = commandBoundary === -1 ? [...args] : args.slice(0, commandBoundary);

  if (commandArgs[0] === "npx" && isCreateCrocoAppExecutable(commandArgs[1])) {
    return commandArgs.slice(2);
  }

  if (commandArgs[0] === "pnpm" && commandArgs[1] === "create" && commandArgs[2] === "croco-app") {
    return commandArgs.slice(3);
  }

  if (
    commandArgs[0] === "pnpm" &&
    commandArgs[1] === "dlx" &&
    isCreateCrocoAppExecutable(commandArgs[2])
  ) {
    return commandArgs.slice(3);
  }

  if (isCreateCrocoAppExecutable(commandArgs[0])) {
    return commandArgs.slice(1);
  }

  return undefined;
}

function isCreateCrocoAppExecutable(arg: string | undefined): boolean {
  return arg === "create-croco-app" || arg?.startsWith("create-croco-app@") === true;
}

async function validatePublicCreateCommand(
  extracted: ExtractedCommand,
  source: PublicDocsSource,
): Promise<PublicCreateCommandValidation> {
  const cliArgs = extractCreateCrocoAppArgs(splitShellWords(extracted.command));

  if (!cliArgs) {
    return {
      failures: [`${source.label}:${extracted.line} could not parse create-croco-app command`],
      isCanonical: false,
      line: extracted.line,
      resolvedJourney: undefined,
    };
  }

  const failures: string[] = [];
  let isCanonical = false;
  let resolvedJourney: string | undefined;

  if (source.requireSkipFlags) {
    const missingSkipFlags = ["--no-install", "--no-git"].filter((flag) => !cliArgs.includes(flag));
    if (missingSkipFlags.length > 0) {
      failures.push(
        `${source.label}:${extracted.line} create-croco-app command must include ${missingSkipFlags.join(" and ")} before manual install steps`,
      );
    }
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "croco-first-success-command-"));
  try {
    const program = createCreateCrocoAppProgram()
      .exitOverride()
      .configureOutput({
        writeErr: () => undefined,
        writeOut: () => undefined,
      });
    program.parse(cliArgs, { from: "user" });

    const directory = program.processedArgs[0];
    const rawOptions = program.opts<Record<string, string | boolean | undefined>>();
    const cliOptions = parseCliOptions(
      typeof directory === "string" ? directory : undefined,
      rawOptions,
    );

    if (!isNonInteractiveOptions(cliOptions)) {
      throw new Error("command does not provide directory, --scope, and --goal or --preset");
    }

    const options = normalizeNonInteractiveOptions(cliOptions);
    resolvedJourney = options.goal ? `goal ${options.goal}` : `preset ${options.preset}`;
    isCanonical = options.goal === "saas-api" && options.preset === "saas";

    const targetDir = join(tempRoot, options.projectName);
    await generate(targetDir, {
      ...options,
      installDeps: false,
      initGit: false,
    });
    if (isCanonical) {
      failures.push(...validateGeneratedSaasJourney(targetDir, source, extracted));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(
      `${source.label}:${extracted.line} create-croco-app command failed the real CLI contract: ${message}`,
    );
  } finally {
    rmSync(tempRoot, { force: true, recursive: true });
  }

  return { failures, isCanonical, line: extracted.line, resolvedJourney };
}

function validateGeneratedSaasJourney(
  targetDir: string,
  source: PublicDocsSource,
  extracted: ExtractedCommand,
): string[] {
  const failures: string[] = [];
  const prefix = `${source.label}:${extracted.line}`;
  const manifest = parseJsonRecord(readFileSync(join(targetDir, "croco.app.json"), "utf-8"));
  const packageJson = parsePackageJson(readFileSync(join(targetDir, "package.json"), "utf-8"));
  const generatedReadme = readFileSync(join(targetDir, "README.md"), "utf-8");

  if (manifest.goal !== "saas-api" || manifest.preset !== "saas" || manifest.protocol !== "rest") {
    failures.push(`${prefix} generated manifest does not describe the REST saas-api journey`);
  }
  if (!packageJson.scripts?.["demo:smoke"]) {
    failures.push(`${prefix} generated package.json is missing scripts.demo:smoke`);
  }
  if (!generatedReadme.includes("pnpm demo:smoke")) {
    failures.push(`${prefix} generated README does not document pnpm demo:smoke`);
  }
  for (const controller of ["OperationsController.ts", "SaasController.ts"]) {
    if (!existsSync(join(targetDir, "apps", "api-server", "src", "controllers", controller))) {
      failures.push(`${prefix} generated REST controller is missing: ${controller}`);
    }
  }
  if (source.label === "getting-started guide") {
    failures.push(
      ...validateGeneratedSaasDocsContract(targetDir, source.content).map(
        (failure) => `${prefix} ${failure}`,
      ),
    );
  }

  return failures;
}

function parseJsonRecord(content: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(content);

  return isRecord(parsed) ? parsed : {};
}

function extractPublicPackageCount(report: string): number | undefined {
  const match = report.match(/^\|\s*Public packages\s*\|\s*(\d+)\s*\|/m);

  return match ? Number(match[1]) : undefined;
}

function validatePackageCountClaims(source: PublicDocsSource, expected: number): string[] {
  const failures: string[] = [];

  for (const match of source.content.matchAll(/\b(\d+)\s+packages\b/g)) {
    const actual = Number(match[1]);

    if (actual !== expected) {
      failures.push(
        `${source.label} package-count claim ${actual} does not match docs/package-docs-report.md public package count ${expected}`,
      );
    }
  }

  return failures;
}

function parsePackageJson(content: string): PackageJsonWithScripts {
  try {
    return JSON.parse(content) as PackageJsonWithScripts;
  } catch {
    return {};
  }
}

function parsePackageCatalog(content: string): PackageCatalog | undefined {
  try {
    return JSON.parse(content) as PackageCatalog;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readCatalogPackageSet(catalog: PackageCatalog, maturity: string): ReadonlySet<string> {
  if (!isRecord(catalog.maturity)) {
    return new Set();
  }

  const maturityConfig = catalog.maturity[maturity];
  if (!isRecord(maturityConfig)) {
    return new Set();
  }

  return new Set(readStringArray(maturityConfig.packages));
}

function getSpineStatusCounts(catalog: PackageCatalog): SpineStatusCounts | undefined {
  if (!isRecord(catalog.spine)) {
    return undefined;
  }

  const spinePackages = readStringArray(catalog.spine.packages);
  if (spinePackages.length === 0) {
    return undefined;
  }

  const packageMaturity = {
    alpha: readCatalogPackageSet(catalog, "alpha"),
    beta: readCatalogPackageSet(catalog, "beta"),
    deprecated: readCatalogPackageSet(catalog, "deprecated"),
    production: readCatalogPackageSet(catalog, "production"),
  };
  const promotion = isRecord(catalog.spine.promotion) ? catalog.spine.promotion : {};
  const promotionPackages = isRecord(promotion.packages)
    ? new Set(Object.keys(promotion.packages))
    : new Set<string>();
  const betaSpinePackages = spinePackages.filter((packageName) =>
    packageMaturity.beta.has(packageName),
  );

  return {
    alpha: spinePackages.filter((packageName) => packageMaturity.alpha.has(packageName)).length,
    beta: betaSpinePackages.length,
    betaPromotionRecords: betaSpinePackages.filter((packageName) =>
      promotionPackages.has(packageName),
    ).length,
    deprecated: spinePackages.filter((packageName) => packageMaturity.deprecated.has(packageName))
      .length,
    production: spinePackages.filter((packageName) => packageMaturity.production.has(packageName))
      .length,
    total: spinePackages.length,
  };
}

function formatSpineStatusSummary(status: SpineStatusCounts): string {
  return `Current 1.0 spine status: ${status.total} spine packages; ${status.production} production-ready, ${status.beta} beta, ${status.alpha} alpha/WIP, ${status.deprecated} deprecated; ${status.betaPromotionRecords} beta promotion records.`;
}

// ── Paths ────────────────────────────────────────────────────────────────────

const ROOT = readRootArg();
const QUICK_START_DIR = join(ROOT, "examples", "quick-start-lambda");
const SAAS_BILLING_DIR = join(ROOT, "examples", "saas-billing-golden-path");

const paths = {
  rootReadme: join(ROOT, "README.md"),
  readme: join(QUICK_START_DIR, "README.md"),
  healthController: join(QUICK_START_DIR, "src", "protocols", "HealthController.ts"),
  userController: join(QUICK_START_DIR, "src", "protocols", "UserController.ts"),
  authProvider: join(QUICK_START_DIR, "src", "integrations", "TestAuthProvider.ts"),
  examplePkg: join(QUICK_START_DIR, "package.json"),
  saasReadme: join(SAAS_BILLING_DIR, "README.md"),
  saasPkg: join(SAAS_BILLING_DIR, "package.json"),
  saasBillingController: join(SAAS_BILLING_DIR, "src", "protocols", "BillingController.ts"),
  saasCheckoutService: join(SAAS_BILLING_DIR, "src", "domain", "CheckoutService.ts"),
  saasGoldenPathSpec: join(SAAS_BILLING_DIR, "src", "tests", "golden-path.spec.ts"),
  gettingStarted: join(
    ROOT,
    "packages",
    "docs",
    "src",
    "content",
    "docs",
    "en",
    "guides",
    "getting-started.mdx",
  ),
  docsIndex: join(ROOT, "packages", "docs", "src", "content", "docs", "en", "index.mdx"),
  createCrocoAppReadme: join(ROOT, "packages", "create-croco-app", "README.md"),
  packageCatalog: join(ROOT, "docs", "package-catalog.json"),
  packageDocsReport: join(ROOT, "docs", "package-docs-report.md"),
  prompts: join(ROOT, "packages", "create-croco-app", "src", "prompts.ts"),
  releaseSpineDocs: join(ROOT, "docs", "release", "croco-1.0-spine.md"),
};

// ── A. Quick-start-lambda endpoint contract ──────────────────────────────────

console.log("\n📋 A. Quick-start-lambda endpoint contract\n");

// A1. README commands match source commands
{
  const readme = read(paths.readme);
  const examplePkg = read(paths.examplePkg);
  const rootPkg = read(join(ROOT, "package.json"));

  // README documents pnpm install + pnpm dev
  if (!readme.includes("pnpm install")) {
    fail("A1a", "README missing `pnpm install` command");
  } else {
    pass("A1a", "README documents `pnpm install`");
  }

  if (!readme.includes("pnpm dev")) {
    fail("A1b", "README missing `pnpm dev` command");
  } else {
    pass("A1b", "README documents `pnpm dev`");
  }

  // Example package.json dev script maps to tsx src/index.ts
  const pkg = parsePackageJson(examplePkg);
  const devScript: string | undefined = pkg.scripts?.dev;
  if (!devScript) {
    fail("A1c", "example quick-start-lambda/package.json missing `scripts.dev`");
  } else if (!devScript.includes("tsx") || !devScript.includes("index.ts")) {
    fail("A1c", `scripts.dev="${devScript}" does not match expected "tsx src/index.ts"`);
  } else {
    pass("A1c", `scripts.dev matches expected pattern (${devScript})`);
  }

  if (!readme.includes("pnpm quick-start-lambda:smoke")) {
    fail("A1d", "README missing `pnpm quick-start-lambda:smoke` validation command");
  } else {
    pass("A1d", "README documents `pnpm quick-start-lambda:smoke`");
  }

  const rootPackageJson = parsePackageJson(rootPkg);
  const smokeScript: string | undefined = rootPackageJson.scripts?.["quick-start-lambda:smoke"];
  if (!smokeScript) {
    fail("A1e", "root package.json missing `quick-start-lambda:smoke` script");
  } else if (
    !runsVerificationScript(
      smokeScript,
      "quick-start-lambda-smoke",
      "scripts/quick-start-lambda-smoke.mts",
    )
  ) {
    fail("A1e", `quick-start-lambda:smoke="${smokeScript}" does not run the smoke script`);
  } else {
    pass("A1e", "root package.json exposes `quick-start-lambda:smoke`");
  }
}

// A2. Health endpoint: GET /api/health returns { status: "ok" }
{
  const healthController = read(paths.healthController);

  if (!healthController.includes('@Controller("/api")')) {
    fail("A2a", "HealthController missing @Controller('/api')");
  } else {
    pass("A2a", "HealthController has @Controller('/api')");
  }

  if (!healthController.includes('@Get("/health")')) {
    fail("A2b", "HealthController missing @Get('/health')");
  } else {
    pass("A2b", "HealthController has @Get('/health')");
  }

  if (!healthController.includes('return { status: "ok" }')) {
    fail("A2c", "health() missing `return { status: 'ok' }`");
  } else {
    pass("A2c", "health() returns { status: 'ok' }");
  }
}

// A3. Users list: GET /api/users with @UseGuards(AuthGuard)
{
  const userController = read(paths.userController);

  if (!userController.includes('@Controller("/api/users")')) {
    fail("A3a", "UserController missing @Controller('/api/users')");
  } else {
    pass("A3a", "UserController has @Controller('/api/users')");
  }

  if (!userController.includes("@Get()")) {
    fail("A3b", "UserController missing @Get()");
  } else {
    pass("A3b", "UserController has @Get()");
  }

  if (!userController.includes("@UseGuards(AuthGuard)")) {
    fail("A3c", "list() missing @UseGuards(AuthGuard)");
  } else {
    pass("A3c", "list() has @UseGuards(AuthGuard)");
  }
}

// A4. Users create: POST /api/users with auth + metering
{
  const userController = read(paths.userController);

  if (!userController.includes("@Post()")) {
    fail("A4a", "UserController missing @Post()");
  } else {
    pass("A4a", "UserController has @Post()");
  }

  const createMethodIndex = userController.indexOf("create(");
  const createBlockStart =
    createMethodIndex === -1
      ? 0
      : Math.max(0, userController.lastIndexOf("\n\n", createMethodIndex));
  const createDecoratorBlock =
    createMethodIndex === -1 ? "" : userController.slice(createBlockStart, createMethodIndex);

  if (
    !createDecoratorBlock.includes("@Post()") ||
    !createDecoratorBlock.includes("@UseGuards(AuthGuard)")
  ) {
    fail("A4b", "create() missing @UseGuards(AuthGuard)");
  } else {
    pass("A4b", "create() has @UseGuards(AuthGuard)");
  }

  if (!userController.includes('@Metered({ meterId: "api_user_create" })')) {
    fail("A4c", "create() missing @Metered({ meterId: 'api_user_create' })");
  } else {
    pass("A4c", "create() has @Metered({ meterId: 'api_user_create' })");
  }
}

// ── B. Auth contract ─────────────────────────────────────────────────────────

console.log("\n📋 B. Auth contract\n");

{
  const auth = read(paths.authProvider);
  const readme = read(paths.readme);

  // TestAuthProvider accepts "test-key", rejects others
  if (!auth.includes('"test-key"')) {
    fail("B1", "TestAuthProvider.ts missing `test-key` check");
  } else {
    pass("B1", "TestAuthProvider.ts checks for `test-key`");
  }

  if (!auth.includes("return null")) {
    fail("B2", "TestAuthProvider.ts missing `return null` for rejected keys");
  } else {
    pass("B2", "TestAuthProvider.ts returns null for non-matching keys");
  }

  // README documents auth note
  if (!readme.includes("x-api-key: test-key")) {
    fail("B3", "README missing `x-api-key: test-key` auth documentation");
  } else {
    pass("B3", "README documents x-api-key: test-key usage");
  }

  // README documents 401 for missing/invalid key
  if (!readme.includes("401")) {
    fail("B4", "README missing 401 auth note");
  } else {
    pass("B4", "README documents 401 for missing/invalid key");
  }
}

// ── C. Metering contract ────────────────────────────────────────────────────

console.log("\n📋 C. Metering contract\n");

{
  const userController = read(paths.userController);
  const readme = read(paths.readme);

  // @Meter on class level with api_user_create
  if (!userController.includes('@Meter({ meterId: "api_user_create" })')) {
    fail("C1", "UserController missing class-level @Meter({ meterId: 'api_user_create' })");
  } else {
    pass("C1", "UserController has class-level @Meter({ meterId: 'api_user_create' })");
  }

  // @Metered on create method
  if (!userController.includes('@Metered({ meterId: "api_user_create" })')) {
    fail("C2", "create() missing @Metered({ meterId: 'api_user_create' })");
  } else {
    pass("C2", "create() has @Metered({ meterId: 'api_user_create' })");
  }

  // README documents api_user_create meter
  if (!readme.includes("api_user_create")) {
    fail("C3", "README missing `api_user_create` meter documentation");
  } else {
    pass("C3", "README documents api_user_create meter");
  }
}

// ── D. SaaS billing golden-path contract ────────────────────────────────────

console.log("\n📋 D. SaaS billing golden-path contract\n");

{
  const readme = read(paths.saasReadme);
  const examplePkg = read(paths.saasPkg);
  const rootPkg = read(join(ROOT, "package.json"));
  const billingController = read(paths.saasBillingController);
  const checkoutService = read(paths.saasCheckoutService);
  const goldenPathSpec = read(paths.saasGoldenPathSpec);
  const gettingStarted = read(paths.gettingStarted);
  const pkg = parsePackageJson(examplePkg);
  const rootPackageJson = parsePackageJson(rootPkg);

  if (!readme.includes("pnpm --filter @croco-example/saas-billing-golden-path dev")) {
    fail("S1a", "SaaS README missing local run command");
  } else {
    pass("S1a", "SaaS README documents local run command");
  }

  if (!readme.includes("pnpm --filter @croco-example/saas-billing-golden-path test")) {
    fail("S1b", "SaaS README missing local test command");
  } else {
    pass("S1b", "SaaS README documents local test command");
  }

  if (!readme.includes("pnpm saas-billing-golden-path:smoke")) {
    fail("S1c", "SaaS README missing root smoke command");
  } else {
    pass("S1c", "SaaS README documents root smoke command");
  }

  const devScript: string | undefined = pkg.scripts?.dev;
  if (!devScript) {
    fail("S2a", "example saas-billing-golden-path/package.json missing `scripts.dev`");
  } else if (!devScript.includes("tsx") || !devScript.includes("src/index.ts")) {
    fail("S2a", `scripts.dev="${devScript}" does not match expected "tsx src/index.ts"`);
  } else {
    pass("S2a", `SaaS scripts.dev matches expected pattern (${devScript})`);
  }

  const testScript: string | undefined = pkg.scripts?.test;
  if (!testScript) {
    fail("S2b", "example saas-billing-golden-path/package.json missing `scripts.test`");
  } else if (!testScript.includes("vitest run src/tests")) {
    fail("S2b", `scripts.test="${testScript}" does not run the checked-in golden path tests`);
  } else {
    pass("S2b", "SaaS scripts.test runs the checked-in golden path tests");
  }

  for (const [label, scriptName] of [
    ["S2c", "typecheck"],
    ["S2d", "build"],
  ] as const) {
    const script = pkg.scripts?.[scriptName];
    if (!script) {
      fail(label, `example saas-billing-golden-path/package.json missing scripts.${scriptName}`);
    } else if (script !== "tsc --noEmit") {
      fail(label, `scripts.${scriptName}="${script}" does not match expected "tsc --noEmit"`);
    } else {
      pass(label, `SaaS scripts.${scriptName} matches expected typecheck command`);
    }
  }

  const smokeScript: string | undefined =
    rootPackageJson.scripts?.["saas-billing-golden-path:smoke"];
  if (!smokeScript) {
    fail("S3", "root package.json missing `saas-billing-golden-path:smoke` script");
  } else if (
    smokeScript !==
    "pnpm --filter @croco-example/saas-billing-golden-path... build && pnpm --filter @croco-example/saas-billing-golden-path test"
  ) {
    fail(
      "S3",
      `saas-billing-golden-path:smoke="${smokeScript}" does not build the example and workspace dependencies before running the checked-in example tests`,
    );
  } else {
    pass("S3", "root package.json exposes `saas-billing-golden-path:smoke`");
  }

  for (const [label, snippet] of [
    ["S4a", '@Controller("/api")'],
    ["S4b", '@Post("/checkouts")'],
    ["S4c", '@Get("/orders/:id")'],
    ["S4d", '@Get("/backoffice/audit")'],
  ] as const) {
    if (!billingController.includes(snippet)) {
      fail(label, `BillingController missing ${snippet}`);
    } else {
      pass(label, `BillingController includes ${snippet}`);
    }
  }

  for (const [label, snippet] of [
    ["S5a", "RetryTemplate"],
    ["S5b", "publishAfterCommit"],
    ["S5c", "withSpan"],
    ["S5d", "CheckoutValidationProblem"],
    ["S5e", "OrderNotFoundProblem"],
  ] as const) {
    if (!checkoutService.includes(snippet)) {
      fail(label, `CheckoutService missing ${snippet}`);
    } else {
      pass(label, `CheckoutService includes ${snippet}`);
    }
  }

  for (const [label, snippet] of [
    ["S6a", "retries transient payment failure"],
    ["S6b", "golden-path/checkout-validation"],
    ["S6c", "golden-path/payment-declined"],
    ["S6d", "golden-path/order-not-found"],
  ] as const) {
    if (!goldenPathSpec.includes(snippet)) {
      fail(label, `golden-path.spec.ts missing ${snippet}`);
    } else {
      pass(label, `golden-path.spec.ts covers ${snippet}`);
    }
  }

  if (!gettingStarted.includes("saas-billing-golden-path")) {
    fail("S7a", "Getting started docs missing reference to saas-billing-golden-path");
  } else {
    pass("S7a", "Getting started docs reference saas-billing-golden-path");
  }

  if (!gettingStarted.includes("pnpm saas-billing-golden-path:smoke")) {
    fail(
      "S7b",
      "Getting started docs missing `pnpm saas-billing-golden-path:smoke` validation command",
    );
  } else {
    pass("S7b", "Getting started docs document SaaS billing golden-path smoke command");
  }
}

// ── E. Docs contract ────────────────────────────────────────────────────────

console.log("\n📋 E. Docs contract\n");

{
  const rootReadme = read(paths.rootReadme);
  const docsIndex = read(paths.docsIndex);
  const createCrocoAppReadme = read(paths.createCrocoAppReadme);
  const gettingStarted = read(paths.gettingStarted);
  const packageCatalog = read(paths.packageCatalog);
  const packageDocsReport = read(paths.packageDocsReport);
  const releaseSpineDocs = read(paths.releaseSpineDocs);
  const rootPackageJson = parsePackageJson(read(join(ROOT, "package.json")));
  const publicDocsSources: PublicDocsSource[] = [
    {
      label: "README.md",
      content: rootReadme,
      requireSkipFlags: true,
    },
    {
      label: "docs landing page",
      content: docsIndex,
    },
    {
      label: "getting-started guide",
      content: gettingStarted,
      requireSkipFlags: true,
    },
    {
      label: "create-croco-app package README",
      content: createCrocoAppReadme,
      requireSkipFlags: true,
    },
  ];
  const firstSuccessDocsSources: PublicDocsSource[] = [
    {
      label: "README.md",
      content: rootReadme,
    },
    {
      label: "getting-started guide",
      content: gettingStarted,
    },
    {
      label: "Croco 1.0 spine release docs",
      content: releaseSpineDocs,
    },
  ];

  // Getting Started links to quick-start-lambda as complete example
  if (!gettingStarted.includes("quick-start-lambda")) {
    fail("D1", "Getting started docs missing reference to quick-start-lambda");
  } else {
    pass("D1", "Getting started docs reference quick-start-lambda");
  }

  if (!gettingStarted.includes("pnpm quick-start-lambda:smoke")) {
    fail("D1b", "Getting started docs missing `pnpm quick-start-lambda:smoke` validation command");
  } else {
    pass("D1b", "Getting started docs document quick-start-lambda smoke command");
  }

  // Getting Started documents create-croco-app command
  if (!gettingStarted.includes("create-croco-app")) {
    fail("D2", "Getting started docs missing create-croco-app command");
  } else {
    pass("D2", "Getting started docs document create-croco-app command");
  }

  const commandFailures = (
    await Promise.all(
      publicDocsSources.map(async (source) => {
        const commands = extractCreateCrocoAppCommands(source.content);

        if (commands.length === 0) {
          return [`${source.label} missing a public create-croco-app command`];
        }

        const validations = await Promise.all(
          commands.map((command) => validatePublicCreateCommand(command, source)),
        );
        const failures = validations.flatMap((validation) => validation.failures);

        if (!validations.some((validation) => validation.isCanonical)) {
          const resolved = validations.find(
            (validation) => validation.resolvedJourney !== undefined,
          );
          failures.push(
            resolved
              ? `${source.label}:${resolved.line} create-croco-app command resolves to ${resolved.resolvedJourney}, not the canonical goal saas-api journey`
              : `${source.label} is missing a valid canonical goal saas-api create-croco-app command`,
          );
        }

        return failures;
      }),
    )
  ).flat();

  if (commandFailures.length > 0) {
    for (const commandFailure of commandFailures) {
      fail("D3", commandFailure);
    }
  } else {
    pass(
      "D3",
      "Public create-croco-app commands validate and each source retains the canonical saas-api journey",
    );
  }

  if (gettingStarted.includes("When prompted")) {
    fail("D4", "Getting started docs describe prompts for the noninteractive quick-start command");
  } else {
    pass("D4", "Getting started docs do not describe prompts for the quick-start command");
  }

  const publicPackageCount = extractPublicPackageCount(packageDocsReport);
  if (publicPackageCount === undefined) {
    fail("D5", "docs/package-docs-report.md missing Public packages summary row");
  } else {
    const packageCountFailures = publicDocsSources.flatMap((source) =>
      validatePackageCountClaims(source, publicPackageCount),
    );

    if (packageCountFailures.length > 0) {
      for (const packageCountFailure of packageCountFailures) {
        fail("D5", packageCountFailure);
      }
    } else {
      pass(
        "D5",
        `Public package-count claims match generated catalog count (${publicPackageCount})`,
      );
    }
  }

  const firstSuccessCommandFailures: string[] = [];
  for (const contract of firstSuccessCommandContracts) {
    if (!rootPackageJson.scripts?.[contract.scriptName]) {
      firstSuccessCommandFailures.push(
        `root package.json missing \`${contract.scriptName}\` script for ${contract.command}`,
      );
      continue;
    }

    for (const source of firstSuccessDocsSources) {
      if (!source.content.includes(contract.command)) {
        firstSuccessCommandFailures.push(
          `${source.label} missing first-success command \`${contract.command}\``,
        );
      }
    }
  }

  if (firstSuccessCommandFailures.length > 0) {
    for (const commandFailure of firstSuccessCommandFailures) {
      fail("D6", commandFailure);
    }
  } else {
    pass("D6", "README, getting-started docs, and release spine docs share first-success commands");
  }

  const toolingFailures = validateRootReadmeTooling(rootReadme, rootPackageJson);

  if (rootReadme.includes("Biome")) {
    toolingFailures.push(
      "README.md still references Biome, but root quality scripts use oxlint/oxfmt",
    );
  }

  if (toolingFailures.length > 0) {
    for (const toolingFailure of toolingFailures) {
      fail("D7", toolingFailure);
    }
  } else {
    pass("D7", "README tooling commands match required root package scripts");
  }

  const catalog = parsePackageCatalog(packageCatalog);
  const spineStatus = catalog ? getSpineStatusCounts(catalog) : undefined;
  if (!spineStatus) {
    fail("D8", "docs/package-catalog.json missing readable spine status metadata");
  } else {
    const expectedStatus = formatSpineStatusSummary(spineStatus);
    const rootReadmeReadinessSection = extractMarkdownSection(
      rootReadme,
      rootReadmeReadinessHeading,
      /\n(?:---|## )/,
    );
    const statusFailures: string[] = [];

    if (!rootReadmeReadinessSection) {
      statusFailures.push(`README.md missing ${rootReadmeReadinessHeading} section`);
    } else if (!rootReadmeReadinessSection.includes(expectedStatus)) {
      statusFailures.push(
        `README.md readiness status section missing generated spine status: ${expectedStatus}`,
      );
    }

    if (!releaseSpineDocs.includes(expectedStatus)) {
      statusFailures.push(
        `Croco 1.0 spine release docs missing generated spine status: ${expectedStatus}`,
      );
    }

    if (statusFailures.length > 0) {
      for (const statusFailure of statusFailures) {
        fail("D8", statusFailure);
      }
    } else {
      pass("D8", "Public 1.0 spine status matches docs/package-catalog.json");
    }
  }
}

// ── F. Scaffold contract ─────────────────────────────────────────────────────

console.log("\n📋 F. Scaffold contract\n");

{
  const prompts = read(paths.prompts);

  // ddd-api preset hint matches expected text
  if (!prompts.includes("Basic DDD skeleton (Drizzle ORM + env utils)")) {
    fail("E1", "prompts.ts ddd-api hint does not match expected text");
  } else {
    pass("E1", "prompts.ts ddd-api hint matches contract");
  }

  // ddd-api preset value exists
  if (!prompts.includes('"ddd-api"')) {
    fail("E2", "prompts.ts missing ddd-api preset");
  } else {
    pass("E2", "prompts.ts has ddd-api preset");
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(""); // blank line

if (failed) {
  console.log("❌ first-success contract verification FAILED — some contracts have drifted.");
  process.exit(1);
} else {
  console.log("✅ first-success contract verification PASSED — all contracts match source.");
  process.exit(0);
}
