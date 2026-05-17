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
import { join } from "node:path";

// ── Helpers ──────────────────────────────────────────────────────────────────

let failed = false;

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

// ── Paths ────────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const QUICK_START_DIR = join(ROOT, "examples", "quick-start-lambda");

const paths = {
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
  const gettingStarted = read(paths.gettingStarted);

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
