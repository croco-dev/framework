import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../doc-examples-check.mts");
const scriptTestTimeout = 30_000;
const tempRoots: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("doc-examples-check.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it(
    "typechecks TypeScript documentation fences marked with typecheck",
    () => {
      const root = createTempRoot();
      writeDocs(root, [
        "# Example",
        "",
        "```ts typecheck",
        'import { greet } from "@croco/alpha";',
        "",
        'const message: string = greet("docs");',
        "```",
        "",
      ]);

      const result = runScript(root, "--check");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("checked 1 TypeScript documentation example");
    },
    scriptTestTimeout,
  );

  it(
    "fails when a typechecked documentation fence no longer matches the public API",
    () => {
      const root = createTempRoot();
      writeDocs(root, [
        "# Example",
        "",
        "```ts typecheck",
        'import { greet } from "@croco/alpha";',
        "",
        'const message: number = greet("docs");',
        "```",
        "",
      ]);

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("documentation example drift detected");
      expect(result.stdout).toContain("Type 'string' is not assignable to type 'number'");
    },
    scriptTestTimeout,
  );

  it(
    "resolves extensionless imports in workspace package source",
    () => {
      const root = createTempRoot();
      writeFileSync(
        join(root, "packages", "alpha", "src", "index.ts"),
        'export { value } from "./value";\n',
      );
      writeFileSync(
        join(root, "packages", "alpha", "src", "value.ts"),
        "export const value = 1;\n",
      );
      writeValidDocs(root);

      expect(runScript(root, "--check").status).toBe(0);
    },
    scriptTestTimeout,
  );

  it(
    "requires untypechecked TypeScript fences to be explicitly marked or recorded",
    () => {
      const root = createTempRoot();
      writeDocs(root, [
        "# Example",
        "",
        "```ts typecheck",
        'import { value } from "@croco/alpha";',
        "",
        "const typedValue: number = value;",
        "```",
        "",
        "```ts",
        "const legacyExample = runtimeOnlyValue;",
        "```",
        "",
      ]);

      const failedCheck = runScript(root, "--check");

      expect(failedCheck.status).toBe(1);
      expect(failedCheck.stdout).toContain("must be marked as `typecheck`, marked as `no-check`");

      const writeResult = runScript(root, "--write");
      const passingCheck = runScript(root, "--check");
      const baseline = readFileSync(join(root, "docs", "doc-examples-baseline.json"), "utf-8");

      expect(writeResult.status).toBe(0);
      expect(passingCheck.status).toBe(0);
      expect(baseline).toContain("Legacy authored docs block");
    },
    scriptTestTimeout,
  );

  it(
    "checks unmarked fences in public package READMEs and skips private packages",
    () => {
      const root = createTempRoot();
      writeValidDocs(root);
      writeFileSync(
        join(root, "packages", "alpha", "README.md"),
        "```typescript\nconst missing = 1;\n```\n",
      );
      writePackage(root, "private-tool", { name: "@croco/private-tool", private: true });
      writeFileSync(
        join(root, "packages", "private-tool", "README.md"),
        "```typescript\nconst ignored = 1;\n```\n",
      );

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("packages/alpha/README.md:1");
      expect(result.stdout).not.toContain("packages/private-tool/README.md");
    },
    scriptTestTimeout,
  );

  it(
    "requires a reason for every spine package without a checked import",
    () => {
      const root = createTempRoot();
      writeValidDocs(root);
      writePackage(root, "beta", { name: "@croco/beta" });
      writeJson(join(root, "docs", "package-catalog.json"), {
        spine: { packages: ["alpha", "beta"] },
      });

      const missing = runScript(root, "--check");
      expect(missing.status).toBe(1);
      expect(missing.stdout).toContain("@croco/beta has no typechecked documentation import");

      writeJson(join(root, "docs", "doc-examples-coverage-baseline.json"), {
        schemaVersion: 1,
        uncoveredPackages: { beta: "Its current README uses generated runtime context." },
      });
      expect(runScript(root, "--check").status).toBe(0);

      writeJson(join(root, "docs", "doc-examples-coverage-baseline.json"), {
        schemaVersion: 1,
        uncoveredPackages: { beta: "  " },
      });
      const emptyReason = runScript(root, "--check");
      expect(emptyReason.status).toBe(1);
      expect(emptyReason.stdout).toContain("beta must include a reason");
    },
    scriptTestTimeout,
  );

  it(
    "counts checked imports from unscoped package entrypoints and rejects stale reasons",
    () => {
      const root = createTempRoot();
      writePackage(root, "generator", { name: "create-croco-app" });
      writeJson(join(root, "docs", "package-catalog.json"), {
        spine: { packages: ["alpha", "generator"] },
      });
      writeDocs(root, [
        "```ts typecheck",
        'import { value } from "@croco/alpha";',
        'import { greet } from "create-croco-app";',
        "void value;",
        'void greet("docs");',
        "```",
      ]);
      expect(runScript(root, "--check").status).toBe(0);

      writeJson(join(root, "docs", "doc-examples-coverage-baseline.json"), {
        schemaVersion: 1,
        uncoveredPackages: { generator: "Old exception." },
      });
      const stale = runScript(root, "--check");
      expect(stale.status).toBe(1);
      expect(stale.stdout).toContain("generator is already covered by a typechecked import");
    },
    scriptTestTimeout,
  );

  it(
    "skips pseudo-code fences marked with skip markers without adding them to the baseline",
    () => {
      const root = createTempRoot();
      writeDocs(root, [
        "# Example",
        "",
        "```ts typecheck",
        'import { value } from "@croco/alpha";',
        "",
        "const typedValue: number = value;",
        "```",
        "",
        "```ts no-check",
        "const generatedAtRuntime: RuntimeOnlyType = container.resolve();",
        "```",
        "",
        "```ts skip-typecheck",
        "const generatedInAnotherRuntime: RuntimeOnlyType = container.resolve();",
        "```",
        "",
      ]);

      const result = runScript(root, "--check");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("checked 1 TypeScript documentation example");
    },
    scriptTestTimeout,
  );

  it(
    "fails when a public operational environment variable is missing from the root template",
    () => {
      const root = createTempRoot();
      writeValidDocs(root);
      writeOperationalEnvironmentTemplate(root, { CROCO_JOBS_URL: undefined });
      writeOperationalSource(
        root,
        "packages/cli/src/commands/jobs.ts",
        "const jobsUrl = getCrocoCommandRuntime().env.CROCO_JOBS_URL;\n",
      );

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "CROCO_JOBS_URL is read by public runtime source but missing from .env.example",
      );
    },
    scriptTestTimeout,
  );

  it(
    "accepts indexed public variables and explicitly excluded platform variables",
    () => {
      const root = createTempRoot();
      writeValidDocs(root);
      writeOperationalEnvironmentTemplate(root);
      writeOperationalSource(
        root,
        "packages/cli/src/commands/jobs.ts",
        "const jobsUrl = getCrocoCommandRuntime().env.CROCO_JOBS_URL;\n",
      );
      writeOperationalSource(
        root,
        "packages/telemetry-sdk-node/src/libs/presets/lambda.ts",
        [
          'const lambdaName = process.env["AWS_LAMBDA_FUNCTION_NAME"];',
          'const executionEnvironment = process.env["AWS_EXECUTION_ENV"];',
          'const compatibilityEnvironment = process.env["ENVIRONMENT"];',
          "",
        ].join("\n"),
      );

      const result = runScript(root, "--check");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("checked 1 TypeScript documentation example");
    },
    scriptTestTimeout,
  );

  it(
    "requires safe placeholders for public operational secrets",
    () => {
      const root = createTempRoot();
      writeValidDocs(root);
      writeOperationalEnvironmentTemplate(root, {
        CROCO_DIAGNOSTICS_TOKEN: "real-looking-token-value",
      });
      writeOperationalSource(
        root,
        "packages/transports-http/src/libs/operationalEndpoints.ts",
        "const token = env.CROCO_DIAGNOSTICS_TOKEN;\n",
      );

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "CROCO_DIAGNOSTICS_TOKEN must use <croco-secret:CROCO_DIAGNOSTICS_TOKEN>",
      );
    },
    scriptTestTimeout,
  );

  it(
    "rejects documented operational variables that are absent from the public policy",
    () => {
      const root = createTempRoot();
      writeValidDocs(root, ["", "Use `CROCO_DOCUMENTED_ONLY` to configure the runtime."]);
      writeOperationalEnvironmentTemplate(root);
      writeOperationalSource(root, "packages/cli/src/index.ts", "export {};\n");

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "CROCO_DOCUMENTED_ONLY is documented as operational configuration but missing from the operational environment policy",
      );
    },
    scriptTestTimeout,
  );

  it(
    "does not hide unknown variables inside a diagnostic namespace",
    () => {
      const root = createTempRoot();
      writeValidDocs(root, ["", "Set `CROCO_HTTP_SECURITY_MODE` for runtime behavior."]);
      writeOperationalEnvironmentTemplate(root);
      writeOperationalSource(root, "packages/cli/src/index.ts", "export {};\n");

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "CROCO_HTTP_SECURITY_MODE is documented as operational configuration but missing from the operational environment policy",
      );
    },
    scriptTestTimeout,
  );

  it(
    "does not treat environment names in diagnostic recovery prose as diagnostic codes",
    () => {
      const root = createTempRoot();
      writeValidDocs(root, ["", "Set `CROCO_REGISTRY_ENV` for runtime behavior."]);
      writeOperationalEnvironmentTemplate(root);
      writeOperationalSource(root, "packages/cli/src/index.ts", "export {};\n");
      writeOperationalSource(
        root,
        "packages/diagnostics-core/src/libs/DiagnosticCodes.ts",
        [
          "const definition = {",
          '  code: "CROCO_DIAGNOSTIC_001",',
          '  action: "Set CROCO_REGISTRY_ENV before starting the runtime.",',
          "};",
          "export { definition };",
          "",
        ].join("\n"),
      );

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "CROCO_REGISTRY_ENV is documented as operational configuration but missing from the operational environment policy",
      );
    },
    scriptTestTimeout,
  );

  it(
    "recognizes diagnostic codes in named const-asserted maps",
    () => {
      const root = createTempRoot();
      writeValidDocs(root, ["", "`CROCO_CLI_UPGRADE_003` reports the legacy security code."]);
      writeOperationalEnvironmentTemplate(root);
      writeOperationalSource(root, "packages/cli/src/index.ts", "export {};\n");
      writeOperationalSource(
        root,
        "packages/cli/src/commands/upgradeRules.ts",
        [
          "const UPGRADE_FINDING_CODES = {",
          '  legacyHttpSecurityCode: "CROCO_CLI_UPGRADE_003",',
          "} as const;",
          "export { UPGRADE_FINDING_CODES };",
          "",
        ].join("\n"),
      );

      const result = runScript(root, "--check");

      expect(result.status).toBe(0);
    },
    scriptTestTimeout,
  );

  it(
    "recognizes desktop removal diagnostics without hiding unknown environment variables",
    () => {
      const root = createTempRoot();
      writeValidDocs(root, [
        "",
        "`CROCO_DESKTOP_REMOVED` reports the removed command.",
        "Set `CROCO_UNKNOWN_CONFIG_MODE` to configure the runtime.",
      ]);
      writeOperationalEnvironmentTemplate(root);
      writeOperationalSource(
        root,
        "packages/cli/src/commands/desktopRemoved.ts",
        'const diagnostic = { code: "CROCO_DESKTOP_REMOVED" };\n',
      );

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "CROCO_UNKNOWN_CONFIG_MODE is documented as operational configuration but missing from the operational environment policy",
      );
      expect(result.stdout).not.toContain("CROCO_DESKTOP_REMOVED is documented");
    },
    scriptTestTimeout,
  );

  it(
    "detects destructured operational environment variables",
    () => {
      const root = createTempRoot();
      writeValidDocs(root);
      writeOperationalEnvironmentTemplate(root);
      writeOperationalSource(
        root,
        "packages/cli/src/index.ts",
        "const { CROCO_UNINDEXED_URL } = process.env;\n",
      );

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "CROCO_UNINDEXED_URL is read by public runtime source but missing from the operational environment policy",
      );
    },
    scriptTestTimeout,
  );

  it(
    "ignores operational environment syntax inside comments and string literals",
    () => {
      const root = createTempRoot();
      writeValidDocs(root);
      writeOperationalEnvironmentTemplate(root);
      writeOperationalSource(
        root,
        "packages/cli/src/index.ts",
        [
          "// process.env.CROCO_COMMENT_ONLY",
          'const example = "process.env.CROCO_STRING_ONLY";',
          "export { example };",
          "",
        ].join("\n"),
      );

      const result = runScript(root, "--check");

      expect(result.status).toBe(0);
    },
    scriptTestTimeout,
  );

  it(
    "detects parameter and assignment destructuring from the environment",
    () => {
      const root = createTempRoot();
      writeValidDocs(root);
      writeOperationalEnvironmentTemplate(root);
      writeOperationalSource(
        root,
        "packages/cli/src/index.ts",
        [
          "function read({ CROCO_PARAMETER_ONLY } = process.env): void {",
          "  void CROCO_PARAMETER_ONLY;",
          "}",
          "let CROCO_ASSIGN_ONLY: string | undefined;",
          "({ CROCO_ASSIGN_ONLY } = process.env);",
          "export { read, CROCO_ASSIGN_ONLY };",
          "",
        ].join("\n"),
      );

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "CROCO_PARAMETER_ONLY is read by public runtime source but missing from the operational environment policy",
      );
      expect(result.stdout).toContain(
        "CROCO_ASSIGN_ONLY is read by public runtime source but missing from the operational environment policy",
      );
    },
    scriptTestTimeout,
  );
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-doc-examples-"));
  tempRoots.push(root);
  writePackage(root, "alpha", {
    name: "@croco/alpha",
  });
  writeJson(join(root, "docs", "package-catalog.json"), {
    spine: { packages: ["alpha"] },
  });
  writeJson(join(root, "docs", "doc-examples-coverage-baseline.json"), {
    schemaVersion: 1,
    uncoveredPackages: {},
  });

  return root;
}

function writeDocs(root: string, lines: readonly string[]): void {
  writeFileSync(join(root, "README.md"), `${lines.join("\n")}\n`);
}

function writeValidDocs(root: string, suffix: readonly string[] = []): void {
  writeDocs(root, [
    "# Example",
    "",
    "```ts typecheck",
    'import { value } from "@croco/alpha";',
    "",
    "const typedValue: number = value;",
    "```",
    "",
    ...suffix,
  ]);
}

function writeOperationalEnvironmentTemplate(
  root: string,
  overrides: Readonly<Record<string, string | undefined>> = {},
): void {
  const variables: Record<string, string> = {
    CROCO_DEV_INSPECTOR_ENABLED: "false",
    CROCO_DEV_INSPECTOR_EXPOSURE: "off",
    CROCO_DEV_INSPECTOR_TOKEN: "<croco-secret:CROCO_DEV_INSPECTOR_TOKEN>",
    CROCO_DIAGNOSTICS_ENABLED: "false",
    CROCO_DIAGNOSTICS_EXPOSURE: "off",
    CROCO_DIAGNOSTICS_TOKEN: "<croco-secret:CROCO_DIAGNOSTICS_TOKEN>",
    CROCO_DI_VALIDATE: "true",
    CROCO_HTTP_DI_VALIDATION: "enforce",
    CROCO_HTTP_SECURITY_VALIDATION: "enforce",
    CROCO_JOBS_URL: "http://localhost:3000",
    NODE_ENV: "development",
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://localhost:4318/v1/traces",
    OTEL_SAMPLING_PROBABILITY: "1.0",
    OTEL_SERVICE_NAME: "test-service",
    TELEMETRY_ENABLED: "false",
  };

  for (const [variable, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete variables[variable];
    } else {
      variables[variable] = value;
    }
  }

  writeFileSync(
    join(root, ".env.example"),
    `${Object.entries(variables)
      .map(([variable, value]) => `# ${variable}=${value}`)
      .join("\n")}\n`,
  );
}

function writeOperationalSource(root: string, relativePath: string, content: string): void {
  const filePath = join(root, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function writePackage(root: string, packageDirName: string, pkg: Record<string, unknown>): void {
  const packageDir = join(root, "packages", packageDirName);
  mkdirSync(join(packageDir, "src"), { recursive: true });
  writeFileSync(
    join(packageDir, "src", "index.ts"),
    [
      "export const value = 1;",
      "",
      "export function greet(name: string): string {",
      "  return `hello ${name}`;",
      "}",
      "",
    ].join("\n"),
  );
  writeJson(join(packageDir, "package.json"), pkg);
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function runScript(root: string, mode: "--check" | "--write"): ScriptResult {
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", scriptPath, mode, "--root", root],
    {
      encoding: "utf-8",
    },
  );

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
