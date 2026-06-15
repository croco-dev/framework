/**
 * first-success-verify.mts
 *
 * Verifies the first-success journey contract by parsing source files.
 * Ensures README documentation, source code, docs, and scaffold stay in sync.
 *
 * Usage: node --experimental-strip-types scripts/first-success-verify.mts
 * Exit: 0 = all contracts pass, 1 = any contract fails
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

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

type ParsedCreateCrocoAppCommand = {
  readonly projectName?: string;
  readonly flags: Map<string, string | boolean>;
};

const CREATE_CROCO_APP_CHOICES = new Map<string, readonly string[]>([
  ["--preset", ["blank", "ddd-api", "ddd-fullstack", "ddd-vike-fullstack"]],
  ["--api", ["graphql", "trpc"]],
  ["--api-hosting", ["standalone", "nextjs"]],
  ["--backend-deploy", ["docker", "lambda"]],
  ["--frontend-deploy", ["opennext", "vercel", "docker", "cloudflare-meta-vite", "vite-spa"]],
]);

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

function extractCreateCrocoAppCommands(content: string): ExtractedCommand[] {
  const commands: ExtractedCommand[] = [];
  const lines = content.split(/\r?\n/);
  let inFence = false;

  for (const [index, rawLine] of lines.entries()) {
    const line = normalizeMarkdownShellLine(rawLine);

    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      if (isCreateCrocoAppCommandSnippet(line)) {
        commands.push({ command: line, line: index + 1 });
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
  const args = splitShellWords(snippet);

  return args.length > 1 && args.some(isCreateCrocoAppExecutable);
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

function parseCreateCrocoAppCommand(command: string): ParsedCreateCrocoAppCommand | undefined {
  const args = splitShellWords(command);
  const executableIndex = args.findIndex(isCreateCrocoAppExecutable);

  if (executableIndex === -1) {
    return undefined;
  }

  let projectName: string | undefined;
  const flags = new Map<string, string | boolean>();

  for (let index = executableIndex + 1; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "&&" || arg === ";") {
      break;
    }

    if (!arg.startsWith("--")) {
      projectName ??= arg;
      continue;
    }

    const [flag, inlineValue] = arg.split("=", 2);

    if (flag === "--no-install" || flag === "--no-git" || flag === "--no-agent-rules") {
      flags.set(flag, false);
      continue;
    }

    if (inlineValue !== undefined) {
      flags.set(flag, inlineValue);
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--") || value === "&&" || value === ";") {
      flags.set(flag, "");
      continue;
    }

    flags.set(flag, value);
    index += 1;
  }

  return { projectName, flags };
}

function isCreateCrocoAppExecutable(arg: string): boolean {
  return arg === "create-croco-app" || arg.startsWith("create-croco-app@");
}

function readStringFlag(flags: Map<string, string | boolean>, flag: string): string | undefined {
  const value = flags.get(flag);

  return typeof value === "string" ? value : undefined;
}

function validatePublicCreateCommand(
  extracted: ExtractedCommand,
  source: PublicDocsSource,
): string[] {
  const parsed = parseCreateCrocoAppCommand(extracted.command);

  if (!parsed) {
    return [`${source.label}:${extracted.line} could not parse create-croco-app command`];
  }

  const failures: string[] = [];
  const preset = readStringFlag(parsed.flags, "--preset");
  const scope = readStringFlag(parsed.flags, "--scope");
  const api = readStringFlag(parsed.flags, "--api");
  const missingRequiredFlags = [
    parsed.projectName ? undefined : "project=<missing>",
    preset ? undefined : "--preset=<missing>",
    scope ? undefined : "--scope=<missing>",
    preset === "ddd-api" || preset === "ddd-fullstack"
      ? api
        ? undefined
        : "--api=<missing>"
      : undefined,
    preset === "ddd-vike-fullstack" && !readStringFlag(parsed.flags, "--frontend-deploy")
      ? "--frontend-deploy=<missing>"
      : undefined,
  ].filter((value): value is string => !!value);

  if (missingRequiredFlags.length > 0) {
    failures.push(
      `${source.label}:${extracted.line} create-croco-app command is missing required noninteractive values: ${missingRequiredFlags.join(", ")}`,
    );
  }

  if (scope && !scope.startsWith("@")) {
    failures.push(`${source.label}:${extracted.line} create-croco-app --scope must start with @`);
  }

  for (const [flag, choices] of CREATE_CROCO_APP_CHOICES) {
    const value = readStringFlag(parsed.flags, flag);
    if (value && !choices.includes(value)) {
      failures.push(
        `${source.label}:${extracted.line} create-croco-app ${flag} value "${value}" is not one of ${choices.join(", ")}`,
      );
    }
  }

  if (preset === "blank") {
    for (const unsupported of [
      "--api",
      "--api-hosting",
      "--backend-deploy",
      "--frontend-deploy",
      "--web-apps",
      "--db",
    ]) {
      if (parsed.flags.has(unsupported)) {
        failures.push(
          `${source.label}:${extracted.line} ${unsupported} is not supported with the blank preset`,
        );
      }
    }
  }

  if (preset === "ddd-api") {
    if (parsed.flags.has("--web-apps")) {
      failures.push(
        `${source.label}:${extracted.line} --web-apps is only supported with the ddd-fullstack preset`,
      );
    }
    if (readStringFlag(parsed.flags, "--api-hosting") === "nextjs") {
      failures.push(
        `${source.label}:${extracted.line} --api-hosting nextjs is only supported with ddd-fullstack`,
      );
    }
    if (parsed.flags.has("--frontend-deploy")) {
      failures.push(
        `${source.label}:${extracted.line} --frontend-deploy is only supported with fullstack presets`,
      );
    }
  }

  if (preset === "ddd-fullstack" && readStringFlag(parsed.flags, "--api-hosting") === "nextjs") {
    const webApps = readStringFlag(parsed.flags, "--web-apps")?.split(",").filter(Boolean) ?? [
      "web",
    ];
    if (webApps.length !== 1) {
      failures.push(
        `${source.label}:${extracted.line} --api-hosting nextjs requires exactly one web app`,
      );
    }
    if (parsed.flags.has("--backend-deploy")) {
      failures.push(
        `${source.label}:${extracted.line} --backend-deploy is only supported with standalone API hosting`,
      );
    }
  }

  if (
    preset === "ddd-vike-fullstack" &&
    readStringFlag(parsed.flags, "--frontend-deploy") !== "cloudflare-meta-vite"
  ) {
    failures.push(
      `${source.label}:${extracted.line} ddd-vike-fullstack only supports --frontend-deploy cloudflare-meta-vite`,
    );
  }

  if (source.requireSkipFlags) {
    const missingSkipFlags = ["--no-install", "--no-git"].filter((flag) => !parsed.flags.has(flag));
    if (missingSkipFlags.length > 0) {
      failures.push(
        `${source.label}:${extracted.line} create-croco-app command must include ${missingSkipFlags.join(" and ")} before manual install steps`,
      );
    }
  }

  return failures;
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

// ── Paths ────────────────────────────────────────────────────────────────────

const ROOT = readRootArg();
const QUICK_START_DIR = join(ROOT, "examples", "quick-start-lambda");

const paths = {
  rootReadme: join(ROOT, "README.md"),
  readme: join(QUICK_START_DIR, "README.md"),
  index: join(QUICK_START_DIR, "src", "index.ts"),
  authProvider: join(QUICK_START_DIR, "src", "AuthProvider.ts"),
  userService: join(QUICK_START_DIR, "src", "UserService.ts"),
  storage: join(QUICK_START_DIR, "src", "storage.ts"),
  examplePkg: join(QUICK_START_DIR, "package.json"),
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
  packageDocsReport: join(ROOT, "docs", "package-docs-report.md"),
  prompts: join(ROOT, "packages", "create-croco-app", "src", "prompts.ts"),
};

// ── A. Quick-start-lambda endpoint contract ──────────────────────────────────

console.log("\n📋 A. Quick-start-lambda endpoint contract\n");

// A1. README commands match source commands
{
  const readme = read(paths.readme);
  const examplePkg = read(paths.examplePkg);

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
  let pkg;
  try {
    pkg = JSON.parse(examplePkg);
  } catch {
    pkg = {};
  }
  const devScript: string | undefined = pkg.scripts?.dev;
  if (!devScript) {
    fail("A1c", "example quick-start-lambda/package.json missing `scripts.dev`");
  } else if (!devScript.includes("tsx") || !devScript.includes("index.ts")) {
    fail("A1c", `scripts.dev="${devScript}" does not match expected "tsx src/index.ts"`);
  } else {
    pass("A1c", `scripts.dev matches expected pattern (${devScript})`);
  }
}

// A2. Health endpoint: GET /api/health returns { status: "ok" }
{
  const index = read(paths.index);

  if (!index.includes('@Controller("/api")')) {
    fail("A2a", "HealthController missing @Controller('/api')");
  } else {
    pass("A2a", "HealthController has @Controller('/api')");
  }

  if (!index.includes('@Get("/health")')) {
    fail("A2b", "HealthController missing @Get('/health')");
  } else {
    pass("A2b", "HealthController has @Get('/health')");
  }

  if (!index.includes('return { status: "ok" }')) {
    fail("A2c", "health() missing `return { status: 'ok' }`");
  } else {
    pass("A2c", "health() returns { status: 'ok' }");
  }
}

// A3. Users list: GET /api/users with @UseGuards(AuthGuard)
{
  const index = read(paths.index);

  if (!index.includes('@Controller("/api/users")')) {
    fail("A3a", "UserController missing @Controller('/api/users')");
  } else {
    pass("A3a", "UserController has @Controller('/api/users')");
  }

  if (!index.includes("@Get()")) {
    fail("A3b", "UserController missing @Get()");
  } else {
    pass("A3b", "UserController has @Get()");
  }

  if (!index.includes("@UseGuards(AuthGuard)")) {
    fail("A3c", "list() missing @UseGuards(AuthGuard)");
  } else {
    pass("A3c", "list() has @UseGuards(AuthGuard)");
  }
}

// A4. Users create: POST /api/users with auth + metering
{
  const index = read(paths.index);

  if (!index.includes("@Post()")) {
    fail("A4a", "UserController missing @Post()");
  } else {
    pass("A4a", "UserController has @Post()");
  }

  // Verify @UseGuards(AuthGuard) on or near @Post()
  // We need to find the Post section - check for both in the file
  if (!index.includes("@UseGuards(AuthGuard)")) {
    fail("A4b", "create() missing @UseGuards(AuthGuard)");
  } else {
    pass("A4b", "create() has @UseGuards(AuthGuard)");
  }

  if (!index.includes('@Metered({ meterId: "api_user_create" })')) {
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

  // AuthProvider accepts "test-key", rejects others
  if (!auth.includes('"test-key"')) {
    fail("B1", "AuthProvider.ts missing `test-key` check");
  } else {
    pass("B1", "AuthProvider.ts checks for `test-key`");
  }

  if (!auth.includes("return null")) {
    fail("B2", "AuthProvider.ts missing `return null` for rejected keys");
  } else {
    pass("B2", "AuthProvider.ts returns null for non-matching keys");
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
  const index = read(paths.index);
  const readme = read(paths.readme);

  // @Meter on class level with api_user_create
  if (!index.includes('@Meter({ meterId: "api_user_create" })')) {
    fail("C1", "UserController missing class-level @Meter({ meterId: 'api_user_create' })");
  } else {
    pass("C1", "UserController has class-level @Meter({ meterId: 'api_user_create' })");
  }

  // @Metered on create method
  if (!index.includes('@Metered({ meterId: "api_user_create" })')) {
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

// ── D. Docs contract ────────────────────────────────────────────────────────

console.log("\n📋 D. Docs contract\n");

{
  const rootReadme = read(paths.rootReadme);
  const docsIndex = read(paths.docsIndex);
  const gettingStarted = read(paths.gettingStarted);
  const packageDocsReport = read(paths.packageDocsReport);
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
  ];

  // Getting Started links to quick-start-lambda as complete example
  if (!gettingStarted.includes("quick-start-lambda")) {
    fail("D1", "Getting started docs missing reference to quick-start-lambda");
  } else {
    pass("D1", "Getting started docs reference quick-start-lambda");
  }

  // Getting Started documents create-croco-app command
  if (!gettingStarted.includes("create-croco-app")) {
    fail("D2", "Getting started docs missing create-croco-app command");
  } else {
    pass("D2", "Getting started docs document create-croco-app command");
  }

  const commandFailures = publicDocsSources.flatMap((source) => {
    const commands = extractCreateCrocoAppCommands(source.content);

    if (commands.length === 0) {
      return [`${source.label} missing a public create-croco-app command`];
    }

    return commands.flatMap((command) => validatePublicCreateCommand(command, source));
  });

  if (commandFailures.length > 0) {
    for (const commandFailure of commandFailures) {
      fail("D3", commandFailure);
    }
  } else {
    pass("D3", "Public create-croco-app commands satisfy the noninteractive contract");
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
}

// ── E. Scaffold contract ─────────────────────────────────────────────────────

console.log("\n📋 E. Scaffold contract\n");

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
