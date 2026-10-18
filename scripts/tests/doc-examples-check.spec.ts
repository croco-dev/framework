import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

  it.each(["```", "````", "`````", "~~~", "~~~~", "~~~~~"])(
    "checks every TypeScript language with %s fences and preserves diagnostic lines",
    (fence) => {
      const root = createTempRoot();
      const languages = ["ts", "tsx", "typescript"];
      const examples = (invalid: boolean) =>
        languages.flatMap((language, index) => [
          `${fence}${language} typecheck`,
          `const example${index}: number = ${invalid ? '"wrong"' : "123"};`,
          fence + fence[0],
          "",
        ]);

      writeValidDocs(root, examples(false));
      const valid = runScript(root, "--check");
      expect(valid.status).toBe(0);
      expect(valid.stdout).toContain("checked 4 TypeScript documentation examples");

      writeValidDocs(root, examples(true));
      const invalid = runScript(root, "--check");
      expect(invalid.status).toBe(1);
      for (const line of [10, 14, 18]) {
        expect(invalid.stdout).toContain(
          `README.md:${line}: Type 'string' is not assignable to type 'number'`,
        );
      }
    },
    scriptTestTimeout,
  );

  it(
    "keeps shorter, mixed and suffixed fences inside the enclosing example",
    () => {
      const root = createTempRoot();
      writeValidDocs(root, [
        "`````markdown",
        "````ts typecheck",
        'const ignored: number = "wrong";',
        "````",
        "~~~~~",
        "````` trailing text",
        "```ts typecheck",
        'const alsoIgnored: number = "wrong";',
        "```",
        "``````",
        "Inline ```ts typecheck is prose.",
        "```ts `typecheck`",
        "~~~ts no-check",
        'const skipped: number = "wrong";',
        "~~~",
        "````tsx skip-typecheck",
        'const skippedToo: number = "wrong";',
        "````",
        "~~~~~typescript pseudo",
        'const pseudo: number = "wrong";',
        "~~~~~",
        "~~~ts typecheck",
        'const checked: number = "wrong";',
        "~~~",
      ]);

      const result = runScript(root, "--check");
      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "README.md:31: Type 'string' is not assignable to type 'number'",
      );
      expect(result.stdout.match(/not assignable/g)).toHaveLength(1);
      expect(result.stdout).not.toContain("must be marked");
    },
    scriptTestTimeout,
  );

  it.each([
    ["direct", "./src/features/main.ts"],
    ["barrel", "./src/features/index.ts"],
    ["canonical", "./src/feature.ts"],
    [
      "conditional",
      {
        require: "./src/wrong.ts",
        types: { import: "./src/features/main.ts", require: "./src/wrong.ts" },
      },
    ],
  ])(
    "matches consumer export resolution for %s targets",
    (_name, target) => {
      const root = createTempRoot();
      const packageDir = join(root, "packages", "alpha");
      writeJson(join(packageDir, "package.json"), {
        name: "@croco/alpha",
        type: "module",
        exports: { ".": "./src/index.ts", "./feature": target },
      });
      writeOperationalSource(
        root,
        "packages/alpha/src/feature.ts",
        `export const feature: ${_name === "canonical" ? "number = 123" : 'string = "private"'};`,
      );
      writeOperationalSource(
        root,
        "packages/alpha/src/wrong.ts",
        'export const feature: string = "require";',
      );
      writeOperationalSource(
        root,
        "packages/alpha/src/features/main.ts",
        "export const feature: number = 123;",
      );
      writeOperationalSource(
        root,
        "packages/alpha/src/features/index.ts",
        'export { feature } from "./main";',
      );
      mkdirSync(join(root, "node_modules", "@croco"), { recursive: true });
      symlinkSync(packageDir, join(root, "node_modules", "@croco", "alpha"), "dir");
      writeJson(join(root, "tsconfig.json"), {
        compilerOptions: {
          module: "esnext",
          moduleResolution: "bundler",
          strict: true,
          noEmit: true,
          types: [],
          skipLibCheck: true,
        },
        files: ["consumer.ts"],
      });
      for (const type of ["string", "number"]) {
        const code = `import { feature } from "@croco/alpha/feature";\nconst result: ${type} = feature;`;
        writeOperationalSource(root, "consumer.ts", code);
        writeDocs(root, ["```ts typecheck", code, "```"]);
        const consumer = spawnSync(
          process.execPath,
          [
            resolve(__dirname, "../../node_modules/typescript/bin/tsc"),
            "-p",
            join(root, "tsconfig.json"),
          ],
          { encoding: "utf-8" },
        );
        const docs = runScript(root, "--check");
        expect(consumer.status, consumer.stdout + consumer.stderr).toBe(type === "number" ? 0 : 2);
        expect(docs.status, docs.stdout + docs.stderr).toBe(type === "number" ? 0 : 1);
      }
    },
    scriptTestTimeout,
  );

  it.each(["import", "require"] as const)(
    "matches consumer resolution-mode %s conditions for valid and invalid assignments",
    (mode) => {
      const root = createTempRoot();
      const packageDir = join(root, "packages", "alpha");
      writeJson(join(packageDir, "package.json"), {
        name: "@croco/alpha",
        exports: {
          ".": { types: { import: "./types/import.d.ts", require: "./types/require.d.ts" } },
        },
      });
      writeOperationalSource(
        root,
        "packages/alpha/types/import.d.ts",
        "export type Value = number;",
      );
      writeOperationalSource(
        root,
        "packages/alpha/types/require.d.ts",
        "export type Value = string;",
      );
      mkdirSync(join(root, "node_modules", "@croco"), { recursive: true });
      symlinkSync(packageDir, join(root, "node_modules", "@croco", "alpha"), "dir");
      writeJson(join(root, "tsconfig.json"), {
        compilerOptions: {
          module: "esnext",
          moduleResolution: "bundler",
          strict: true,
          noEmit: true,
          types: [],
          skipLibCheck: true,
        },
        files: ["consumer.ts"],
      });
      for (const type of ["string", "number"]) {
        const code = `import type { Value } from "@croco/alpha" with { "resolution-mode": "${mode}" };\nconst result: Value = ${type === "number" ? "123" : '"require"'};`;
        writeOperationalSource(root, "consumer.ts", code);
        writeDocs(root, ["```ts typecheck", code, "```"]);
        const consumer = spawnSync(
          process.execPath,
          [
            resolve(__dirname, "../../node_modules/typescript/bin/tsc"),
            "-p",
            join(root, "tsconfig.json"),
          ],
          { encoding: "utf-8" },
        );
        const docs = runScript(root, "--check");
        const valid = type === (mode === "require" ? "string" : "number");
        expect(consumer.status, consumer.stdout + consumer.stderr).toBe(valid ? 0 : 2);
        expect(docs.status, docs.stdout + docs.stderr).toBe(valid ? 0 : 1);
      }
    },
    scriptTestTimeout,
  );

  it(
    "honors root targets, export patterns and private export exclusions",
    () => {
      const root = createTempRoot();
      writeJson(join(root, "packages/alpha/package.json"), {
        name: "@croco/alpha",
        exports: {
          ".": "./src/public.ts",
          "./features/*": "./src/features/*.ts",
          "./features/private": null,
        },
      });
      writeOperationalSource(
        root,
        "packages/alpha/src/public.ts",
        "export const value: string = 'public';",
      );
      writeOperationalSource(
        root,
        "packages/alpha/src/features/one.ts",
        "export const feature: number = 123;",
      );
      writeOperationalSource(
        root,
        "packages/alpha/src/features/private.ts",
        "export const secret = 456;",
      );
      writeDocs(root, [
        "```ts typecheck",
        'import { value } from "@croco/alpha";',
        'import { feature } from "@croco/alpha/features/one";',
        "const text: string = value;",
        "const count: number = feature;",
        "```",
      ]);
      expect(runScript(root, "--check").status).toBe(0);
      writeDocs(root, [
        "```ts typecheck",
        'import { secret } from "@croco/alpha/features/private";',
        "```",
      ]);
      const denied = runScript(root, "--check");
      expect(denied.status).toBe(1);
      expect(denied.stdout).toContain("Cannot find module '@croco/alpha/features/private'");
    },
    scriptTestTimeout,
  );

  it(
    "reports a build prerequisite instead of substituting source for missing export artifacts",
    () => {
      const root = createTempRoot();
      writeJson(join(root, "packages/alpha/package.json"), {
        name: "@croco/alpha",
        exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
      });
      writeValidDocs(root);
      const result = runScript(root, "--check");
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("pnpm build");
      expect(result.stdout).toContain("@croco/alpha");
      writeOperationalSource(
        root,
        "packages/alpha/dist/index.d.ts",
        "export declare const value: number;",
      );
      expect(runScript(root, "--check").status).toBe(0);
    },
    scriptTestTimeout,
  );

  it(
    "does not promote skipped declaration imports into documentation failures or build hints",
    () => {
      const root = createTempRoot();
      writeJson(join(root, "packages/alpha/package.json"), {
        name: "@croco/alpha",
        exports: { ".": "./src/public.d.ts" },
      });
      writeOperationalSource(
        root,
        "packages/alpha/src/public.d.ts",
        'import type { Unused } from "@croco/beta"; export type Value = string;',
      );
      writePackage(root, "beta", {
        name: "@croco/beta",
        exports: { ".": { types: "./dist/index.d.ts" } },
      });
      writeDocs(root, [
        "```ts typecheck",
        'import type { Value } from "@croco/alpha";',
        'const value: Value = "visible";',
        "```",
      ]);
      const passing = runScript(root, "--check");
      expect(passing.status, passing.stdout + passing.stderr).toBe(0);
      writeDocs(root, [
        "```ts typecheck",
        'import type { Value } from "@croco/alpha";',
        "const value: Value = 123;",
        "```",
      ]);
      const failing = runScript(root, "--check");
      expect(failing.status).toBe(1);
      expect(failing.stdout).toContain("Type 'number' is not assignable to type 'string'");
      expect(failing.stdout).not.toContain("Cannot resolve public export '@croco/beta'");
    },
    scriptTestTimeout,
  );

  it.each(["docs/a b.md", "docs/a_b.md", "docs/한글.md", "docs/예제.md"])(
    "reports type errors in %s without another document replacing its block",
    (invalidPath) => {
      const root = createTempRoot();
      writeValidDocs(root);
      for (const file of ["docs/a b.md", "docs/a_b.md", "docs/한글.md", "docs/예제.md"]) {
        const value = file === invalidPath ? '"wrong"' : "1";
        writeFileSync(
          join(root, file),
          ["# Example", "", "```ts typecheck", `const value: number = ${value};`, "```", ""].join(
            "\n",
          ),
        );
      }

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        `${invalidPath}:4: Type 'string' is not assignable to type 'number'`,
      );
      expect(result.stdout.match(/Type 'string' is not assignable to type 'number'/g)).toHaveLength(
        1,
      );
    },
    scriptTestTimeout,
  );

  it(
    "checks every block in colliding document names while preserving relative imports",
    () => {
      const root = createTempRoot();
      writeValidDocs(root);
      writeFileSync(join(root, "docs", "value.ts"), "export const value = 7;\n");
      for (const file of ["a b.md", "a_b.md", "한글.md", "예제.md"]) {
        writeFileSync(
          join(root, "docs", file),
          [
            "```ts typecheck",
            'import { value } from "./value";',
            "const result: number = value;",
            "```",
            "",
            "```ts typecheck",
            "const label: string = 'second block';",
            "```",
            "",
          ].join("\n"),
        );
      }

      const result = runScript(root, "--check");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("checked 9 TypeScript documentation examples");
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
    "resolves documentation dependencies from the Markdown package directory",
    () => {
      const root = createTempRoot();
      writeValidDocs(root);
      const packageDir = join(root, "packages", "docs");
      const dependencyDir = join(packageDir, "node_modules", "doc-schema");
      writeJson(join(dependencyDir, "package.json"), {
        name: "doc-schema",
        types: "index.d.ts",
      });
      writeFileSync(join(dependencyDir, "index.d.ts"), "export declare const value: string;\n");
      const guidePath = join(packageDir, "src", "content", "docs", "en", "guides", "schema.mdx");
      mkdirSync(dirname(guidePath), { recursive: true });
      writeFileSync(
        guidePath,
        [
          "```ts typecheck",
          'import { value } from "doc-schema";',
          "const result: string = value;",
          "```",
          "",
        ].join("\n"),
      );

      const passing = runScript(root, "--check");
      expect(passing.stdout).toContain("checked 2 TypeScript documentation examples");
      expect(passing.status).toBe(0);

      writeFileSync(join(dependencyDir, "index.d.ts"), "export declare const value: number;\n");
      const drift = runScript(root, "--check");
      expect(drift.status).toBe(1);
      expect(drift.stdout).toContain(
        "schema.mdx:3: Type 'number' is not assignable to type 'string'",
      );
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
    "skips private package READMEs without a package name",
    () => {
      const root = createTempRoot();
      writeValidDocs(root);
      writePackage(root, "private-tool", { private: true });
      writeFileSync(
        join(root, "packages", "private-tool", "README.md"),
        "```typescript\nconst ignored = 1;\n```\n",
      );

      const result = runScript(root, "--check");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("checked 1 TypeScript documentation example");
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
    CROCO_AGENT_APPLICATION: "/absolute/path/to/application.mjs",
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
    OTEL_SDK_DISABLED: "false",
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
