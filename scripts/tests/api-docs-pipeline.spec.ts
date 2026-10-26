import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { apiDocModelEntryPoints, apiDocPackages } from "../../packages/docs/api-docs.config.mjs";
import { moveBuildOutput } from "../../packages/docs/scripts/move-build-output.mts";
import { prunePreviouslyDocumentedExports } from "../../packages/docs/scripts/prepare-api-models.mjs";
import {
  normalizeCliDiagnosticDefinitions,
  normalizeDrizzleChallengeClient,
  sanitizeGeneratedTypeDocIndex,
} from "../../packages/docs/scripts/sanitize-typedoc-index.mjs";

type PackageManifest = {
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly name?: string;
  readonly scripts?: Readonly<Record<string, string>>;
};

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../..");
const API_DOCS_ROOT = join(REPOSITORY_ROOT, "packages", "docs", "src", "content", "docs", "api");
const MODEL_SCRIPT =
  "node --experimental-strip-types ../docs/scripts/generate-package-api-model.mts";
const DOCS_WRAPPER = "node --experimental-strip-types scripts/build-docs.mts";
const TEMP_ROOTS: string[] = [];

function readManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

function markdownFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith(".md") ? [path] : [];
  });
}

describe("API documentation pipeline", () => {
  afterEach(() => {
    for (const root of TEMP_ROOTS.splice(0)) rmSync(root, { force: true, recursive: true });
  });

  it("moves the built site without copying it on the same filesystem", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-docs-output-"));
    TEMP_ROOTS.push(root);
    const source = join(root, "temporary", "dist");
    const destination = join(root, "published", "dist");
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "index.html"), "built site");

    moveBuildOutput(source, destination);

    expect(existsSync(source)).toBe(false);
    expect(readFileSync(join(destination, "index.html"), "utf8")).toBe("built site");
  });

  it("copies the built site only when a cross-device rename fails", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-docs-output-"));
    TEMP_ROOTS.push(root);
    const source = join(root, "temporary", "dist");
    const destination = join(root, "published", "dist");
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "index.html"), "built site");
    const rename = vi.fn(() => {
      throw Object.assign(new Error("Cross-device link"), { code: "EXDEV" });
    });

    moveBuildOutput(source, destination, rename);

    expect(rename).toHaveBeenCalledOnce();
    expect(readFileSync(join(destination, "index.html"), "utf8")).toBe("built site");
  });

  it("propagates other output move failures", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-docs-output-"));
    TEMP_ROOTS.push(root);
    const source = join(root, "temporary", "dist");
    const destination = join(root, "published", "dist");
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "index.html"), "built site");
    const failure = new Error("Access denied");
    const rename = () => {
      throw failure;
    };

    expect(() => moveBuildOutput(source, destination, rename)).toThrow(failure);
    expect(existsSync(source)).toBe(true);
    expect(existsSync(destination)).toBe(false);
  });

  it("keeps one canonical, ordered package-model catalog", () => {
    const docsManifest = readManifest(join(REPOSITORY_ROOT, "packages", "docs", "package.json"));
    const modelDependencies = Object.entries(docsManifest.devDependencies ?? {})
      .filter(([, version]) => version.startsWith("workspace:"))
      .map(([name]) => name)
      .sort();
    expect(apiDocPackages.map(({ packageName }) => packageName).sort()).toEqual(modelDependencies);
    expect(new Set(apiDocPackages.map(({ packageName }) => packageName)).size).toBe(
      apiDocPackages.length,
    );
    expect(new Set(apiDocPackages.map(({ directory }) => directory)).size).toBe(
      apiDocPackages.length,
    );
    expect(new Set(apiDocPackages.map(({ moduleName }) => moduleName)).size).toBe(
      apiDocPackages.length,
    );
    expect(apiDocPackages.map(({ packageName }) => packageName)).toEqual(
      expect.arrayContaining([
        "@croco/research-core",
        "@croco/research-drizzle",
        "@croco/seo-core",
      ]),
    );
    expect(apiDocModelEntryPoints).toEqual(
      apiDocPackages.map(({ directory }) => `../${directory}/.turbo/docs-api/model.json`),
    );
  });

  it.each([
    ["admin-core", "EnrichmentOperations", "read", "EnrichmentPage"],
    ["analytics-drizzle", "DrizzleEnrichmentStore", "load", "EnrichmentRun"],
  ])(
    "preserves %s enrichment return types without dependency build artifacts",
    (directory, className, methodName, resultName) => {
      const root = mkdtempSync(join(tmpdir(), "croco-enrichment-api-"));
      TEMP_ROOTS.push(root);
      const output = join(root, "model.json");
      const script = String.raw`
        import { createRequire } from "node:module";
        import { pathToFileURL } from "node:url";
        const docsRequire = createRequire(${JSON.stringify(join(REPOSITORY_ROOT, "packages/docs/package.json"))});
        const typedocPath = docsRequire.resolve("typedoc");
        const { Application } = await import(pathToFileURL(typedocPath).href);
        const ts = createRequire(typedocPath)("typescript");
        const fileExists = ts.sys.fileExists;
        ts.sys.fileExists = (path) =>
          !path.replaceAll("\\", "/").includes("/analytics-core/dist/") && fileExists(path);
        const { apiDocCompilerOptions } = await import(${JSON.stringify(join(REPOSITORY_ROOT, "packages/docs/api-docs.config.mjs"))});
        const app = await Application.bootstrap({
          entryPoints: [${JSON.stringify(join(REPOSITORY_ROOT, "packages", directory, "src/index.ts"))}],
          compilerOptions: apiDocCompilerOptions,
          disableSources: true,
          excludeInternal: true,
          excludePrivate: true,
          excludeProtected: true,
          excludeReferences: true,
          readme: "none",
          skipErrorChecking: true,
        }, []);
        const project = await app.convert();
        if (!project || app.logger.hasErrors()) throw new Error("API model conversion failed");
        await app.generateJson(project, ${JSON.stringify(output)});
      `;
      const result = spawnSync(process.execPath, ["--input-type=module"], {
        cwd: join(REPOSITORY_ROOT, "packages", directory),
        input: script,
        encoding: "utf8",
      });
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const model = JSON.parse(readFileSync(output, "utf8")) as {
        children: {
          name: string;
          children: { name: string; signatures: { type: { typeArguments: unknown[] } }[] }[];
        }[];
      };
      const method = model.children
        .find(({ name }) => name === className)
        ?.children.find(({ name }) => name === methodName);
      const argument = method?.signatures[0].type.typeArguments[0];
      if (directory === "admin-core") {
        expect(argument).toMatchObject({ type: "reference", name: resultName });
      } else {
        expect(argument).toMatchObject({
          type: "union",
          types: expect.arrayContaining([
            expect.objectContaining({ type: "reference", name: resultName }),
            { type: "literal", value: null },
          ]),
        });
      }
    },
    60000,
  );

  it("gives every documented package a cacheable model task and docs dependency edge", () => {
    const docsManifest = readManifest(join(REPOSITORY_ROOT, "packages", "docs", "package.json"));
    expect(docsManifest.scripts?.["docs:api:render"]).toBe(`${DOCS_WRAPPER} --api-render`);
    expect(docsManifest.scripts?.dev).toBe(`${DOCS_WRAPPER} --dev`);
    expect(docsManifest.scripts?.start).toBe(`${DOCS_WRAPPER} --dev`);
    expect(docsManifest.scripts?.["docs:dev"]).toBe(`${DOCS_WRAPPER} --dev`);

    for (const entry of apiDocPackages) {
      const packageRoot = join(REPOSITORY_ROOT, "packages", entry.directory);
      const manifest = readManifest(join(packageRoot, "package.json"));
      expect(manifest.name, entry.directory).toBe(entry.packageName);
      expect(manifest.scripts?.["docs:api:model"], entry.packageName).toBe(MODEL_SCRIPT);
      expect(docsManifest.devDependencies?.[entry.packageName], entry.packageName).toBe(
        "workspace:*",
      );
      expect(existsSync(join(packageRoot, entry.entryPoint)), entry.packageName).toBe(true);

      const entryModule = entry.entryPoint.replace(/\/index\.ts$/, "").replace(/\.ts$/, "");
      expect(entry.moduleName, entry.packageName).toBe(`${entry.directory}/${entryModule}`);
    }
  });

  it("prepares models before a package-local docs development server starts", () => {
    const fakeBin = createFakePnpm();
    const logPath = join(fakeBin, "calls.jsonl");
    const result = spawnSync(
      "node",
      [
        "--experimental-strip-types",
        join(REPOSITORY_ROOT, "packages", "docs", "scripts", "build-docs.mts"),
        "--dev",
      ],
      {
        cwd: join(REPOSITORY_ROOT, "packages", "docs"),
        encoding: "utf8",
        env: {
          ...process.env,
          CROCO_DOCS_API_ONLY: "1",
          CROCO_DOCS_BUILD_ROOT: "unsafe-external-root",
          FAKE_DOCS_DEV_LOG: logPath,
          PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ""}`,
          TURBO_HASH: "",
        },
      },
    );
    const calls = readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(result.status, result.stderr).toBe(0);
    expect(calls.map(({ args }) => args)).toEqual([
      ["--workspace-root", "turbo", "run", "docs:api:model", "--env-mode=loose"],
      ["exec", "astro", "dev", "--host"],
    ]);
    expect(calls[1]).toMatchObject({ apiOnly: null, buildRoot: null });
  });

  it("formats a large generated tree with bounded arguments and preserves neighboring files", () => {
    const fixture = createRenderFixture(7100);
    const result = fixture.run();

    expect(result.status, result.stdout + result.stderr).toBe(0);
    const calls = fixture.calls();
    const formatCalls = calls.filter(({ args }) => args[1] === "oxfmt");
    expect(formatCalls).toHaveLength(1);
    // A directory or bounded glob must replace the per-document argv expansion.
    expect(Buffer.byteLength(JSON.stringify(formatCalls[0].args))).toBeLessThan(4096);
    const output = markdownFiles(fixture.output);
    expect(output).toHaveLength(7100);
    for (const path of output) {
      expect(readFileSync(path, "utf8"), path).toBe("# Generated\n\n- value\n");
    }
    expect(readFileSync(fixture.neighbor, "utf8")).toBe("# Neighbor  \n");
    expect(existsSync(join(fixture.output, "previous.md"))).toBe(false);
    for (const call of calls) {
      if (call.buildRoot) expect(existsSync(call.buildRoot)).toBe(false);
    }
    expect(readdirSync(fixture.temporary)).toEqual([]);
  }, 60000);

  it("preserves published docs and cleans the temporary tree when formatting fails", () => {
    const fixture = createRenderFixture(2, true);
    const result = fixture.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("failed with exit code 23");
    expect(readdirSync(fixture.output)).toEqual(["previous.md"]);
    expect(readFileSync(join(fixture.output, "previous.md"), "utf8")).toBe("previous\n");
    expect(readFileSync(fixture.neighbor, "utf8")).toBe("# Neighbor  \n");
    expect(readdirSync(fixture.temporary)).toEqual([]);
  });

  it("matches the tracked generated API package directories", () => {
    const generatedDirectories = readdirSync(API_DOCS_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => name)
      .sort();
    const catalogDirectories = apiDocPackages.map(({ directory }) => directory).sort();
    expect(generatedDirectories).toEqual(catalogDirectories);
  });

  it("documents wrapped route schemas consistently across decorators and contract aliases", () => {
    for (const path of [
      "functions/Param.md",
      "functions/Query.md",
      "functions/routeParamSchema.md",
      "functions/routeQueryParamSchema.md",
      "type-aliases/RouteContractWithParams.md",
      "type-aliases/RouteContractWithQuery.md",
    ]) {
      const content = readFileSync(join(API_DOCS_ROOT, "protocols-rest/src", path), "utf8");
      expect(content, path).toContain("RouteParameterSchema");
      expect(content, path).not.toContain("AnyZodObject");
    }
  });

  it("documents decorator output keys separately from schema helper input keys", () => {
    const param = readFileSync(
      join(API_DOCS_ROOT, "protocols-rest/src/functions/Param.md"),
      "utf8",
    );
    expect(param).toContain("routepathparams/");
    expect(param).not.toContain("routepathparamname/");
    for (const name of ["routeParamSchema", "routeQueryParamSchema"]) {
      const content = readFileSync(
        join(API_DOCS_ROOT, `protocols-rest/src/functions/${name}.md`),
        "utf8",
      );
      const constraint = content.split("### Name")[1].split("## Parameters")[0];
      expect(constraint, name).toContain("RouteParameterObject");
      expect(constraint, name).toContain('"shape"');
      expect(constraint, name).not.toContain("routepathparams/");
      expect(constraint, name).not.toContain("routequery/");
    }
  });

  it("contains no untranslated TypeDoc Markdown theme tokens", () => {
    const untranslated = markdownFiles(API_DOCS_ROOT).filter((path) =>
      /\btheme_[a-z_]+\b/.test(readFileSync(path, "utf8")),
    );
    expect(untranslated).toEqual([]);
  });

  it("keeps the custom diagnostic table formatter-stable across repeated Astro setup", () => {
    const typeDocOutput = [
      "---",
      'title: "CROCO_DIAGNOSTIC_CODE_DEFINITIONS"',
      "---",
      "",
      "> `const` **CROCO_DIAGNOSTIC_CODE_DEFINITIONS**: readonly []",
      "",
    ].join("\n");
    const normalized = normalizeCliDiagnosticDefinitions(typeDocOutput);

    expect(normalized).toContain(
      "| Code                            | Legacy aliases / patterns                 | Title                                                         | Action                                                                                                                      |",
    );
    expect(normalized).toContain(
      "| ------------------------------- | ----------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |",
    );
    expect(normalized).toContain("---\n\n## CLI Diagnostic Definitions");
    const jobsIdRow = normalized.split("\n").find((line) => line.includes("`CROCO_CLI_JOBS_006`"));
    expect(jobsIdRow).toContain("`cli/invalid-jobs-id`");
    expect(jobsIdRow).toContain("Jobs command job id is invalid");
    expect(jobsIdRow).toContain(
      'Pass a job id other than an empty string, ".", or ".." before retrying the command.',
    );
    expect(normalizeCliDiagnosticDefinitions(normalized)).toBe(normalized);
  });

  it("removes only the absent challenge schema namespace link from the client type", () => {
    const namespaceLink =
      "[`challengeSchema`](/api/gamification-drizzle/src/namespaces/challengeschema/readme/)";
    const validLink =
      "[`DrizzleChallengeStore`](/api/gamification-drizzle/src/classes/drizzlechallengestore/)";
    const input = `> **DrizzleChallengeClient** = \`NodePgDatabase\`\\<_typeof_ ${namespaceLink}\\>\n\n${validLink}\n`;
    const normalized = normalizeDrizzleChallengeClient(input);

    expect(normalized).toBe(input.replace(namespaceLink, "`challengeSchema`"));
    expect(normalized).toContain(validLink);
    expect(normalizeDrizzleChallengeClient(normalized)).toBe(normalized);
  });

  it("renders the challenge client without a link to an absent namespace page", () => {
    const client = readFileSync(
      join(API_DOCS_ROOT, "gamification-drizzle/src/type-aliases/DrizzleChallengeClient.md"),
      "utf8",
    );
    expect(client).toContain("_typeof_ `challengeSchema`");
    expect(client).not.toContain("/namespaces/challengeschema/readme/");
  });

  it("does not sanitize tracked API docs during Astro preview", async () => {
    const sanitize = vi.fn(async () => undefined);
    const integration = sanitizeGeneratedTypeDocIndex(sanitize);

    await integration.hooks["config:setup"]({ command: "preview" });
    expect(sanitize).not.toHaveBeenCalled();

    await integration.hooks["config:setup"]({ command: "build" });
    expect(sanitize).toHaveBeenCalledOnce();
  });

  it("preserves cross-package inheritance and revived symbol links after model merge", () => {
    const problemSubclass = readFileSync(
      join(
        API_DOCS_ROOT,
        "events-core",
        "src",
        "classes",
        "EventAfterCommitRequiresActiveTransactionProblem.md",
      ),
      "utf8",
    );

    expect(problemSubclass).toContain("- [`Problem`](/api/problems-core/src/classes/problem/)");
    expect(problemSubclass).toContain(
      "[`Problem`](/api/problems-core/src/classes/problem/).[`cause`](/api/problems-core/src/classes/problem/#cause)",
    );
  });

  it("keeps pruned inheritance links broken so merge revive binds the direct parent", () => {
    // A pruned `inheritedFrom` numeric target points at a member clone inside
    // a pruned re-export alias of the direct parent (for example `4`, the alias
    // member of `Parent`). Rewriting it to the shared declaration symbol would
    // let the merge resolve it to whichever sibling clone registered that
    // symbol first, making links catalog-order dependent (see #3417).
    const parentSymbol = {
      packageName: "@croco/owner",
      packagePath: "src/index.ts",
      qualifiedName: "Parent",
    };
    const problemCauseSymbol = {
      packageName: "@croco/problems-core",
      packagePath: "src/libs/Problem.ts",
      qualifiedName: "Problem.cause",
    };
    const ownerModel = {
      children: [
        {
          id: 1,
          name: "Parent",
          children: [{ id: 2, name: "cause" }],
        },
      ],
      symbolIdMap: { 1: parentSymbol, 2: problemCauseSymbol },
    };
    const childModel = {
      children: [
        {
          // Re-export alias of Parent, pruned when the owner model ran first.
          id: 3,
          name: "Parent",
          children: [{ id: 4, name: "cause" }],
        },
        {
          id: 5,
          name: "ChildProblem",
          extendedTypes: [{ type: "reference", name: "Parent", target: 3 }],
          children: [
            {
              id: 6,
              name: "cause",
              inheritedFrom: { type: "reference", name: "Parent.cause", target: 4 },
            },
          ],
        },
      ],
      groups: [{ title: "Problems", children: [3, 5] }],
      symbolIdMap: {
        3: parentSymbol,
        4: problemCauseSymbol,
        5: {
          packageName: "@croco/child",
          packagePath: "src/index.ts",
          qualifiedName: "ChildProblem",
        },
        6: problemCauseSymbol,
      },
    };

    const seenSymbols = new Set<string>();
    prunePreviouslyDocumentedExports(structuredClone(ownerModel), seenSymbols, "@croco/owner");
    const prepared = prunePreviouslyDocumentedExports(
      structuredClone(childModel),
      seenSymbols,
      "@croco/child",
    );

    const childClass = prepared.children.find(
      (reflection: { name: string }) => reflection.name === "ChildProblem",
    );
    // The alias member is pruned but the surviving class and its member stay.
    expect(prepared.children.map((reflection: { name: string }) => reflection.name)).toEqual([
      "ChildProblem",
    ]);
    expect(childClass.children[0].inheritedFrom).toEqual({
      type: "reference",
      name: "Parent.cause",
      target: -1,
    });
    // The direct-parent link itself is preserved as a symbol reference so
    // merge revive can recompute the member link from it.
    expect(childClass.extendedTypes).toEqual([
      { type: "reference", name: "Parent", target: parentSymbol },
    ]);
  });

  it("deduplicates re-exports while preserving references to the canonical symbol", () => {
    const seenSymbols = new Set<string>();
    const sharedRootSymbol = {
      packageName: "@croco/shared",
      packagePath: "src/index.ts",
      qualifiedName: "SharedContract",
    };
    const sharedMemberSymbol = {
      packageName: "@croco/shared",
      packagePath: "src/index.ts",
      qualifiedName: "SharedContract.value",
    };
    const firstModel = {
      children: [{ id: 1, name: "SharedContract" }],
      symbolIdMap: { 1: sharedRootSymbol },
    };
    const secondModel = {
      children: [
        {
          id: 2,
          name: "SharedContract",
          children: [{ id: 3, name: "value" }],
        },
        {
          id: 4,
          name: "Consumer",
          type: { type: "reference", name: "value", target: 3 },
        },
      ],
      groups: [{ title: "Contracts", children: [2, 4] }],
      symbolIdMap: {
        2: sharedRootSymbol,
        3: sharedMemberSymbol,
        4: {
          packageName: "@croco/consumer",
          packagePath: "src/index.ts",
          qualifiedName: "Consumer",
        },
      },
    };

    prunePreviouslyDocumentedExports(firstModel, seenSymbols, "@croco/shared");
    prunePreviouslyDocumentedExports(secondModel, seenSymbols, "@croco/consumer");

    expect(secondModel.children).toEqual([
      {
        id: 4,
        name: "Consumer",
        type: { type: "reference", name: "value", target: sharedMemberSymbol },
      },
    ]);
    expect(secondModel.groups).toEqual([{ title: "Contracts", children: [4] }]);
    expect(secondModel.symbolIdMap).toEqual({
      4: {
        packageName: "@croco/consumer",
        packagePath: "src/index.ts",
        qualifiedName: "Consumer",
      },
    });
  });
});

function createFakePnpm(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-docs-dev-bin-"));
  TEMP_ROOTS.push(root);
  const implementation = join(root, "pnpm-fake.cjs");
  writeFileSync(
    implementation,
    [
      'const { appendFileSync } = require("node:fs");',
      "appendFileSync(",
      "  process.env.FAKE_DOCS_DEV_LOG,",
      "  JSON.stringify({",
      "    apiOnly: process.env.CROCO_DOCS_API_ONLY ?? null,",
      "    args: process.argv.slice(2),",
      "    buildRoot: process.env.CROCO_DOCS_BUILD_ROOT ?? null,",
      "    cwd: process.cwd(),",
      '  }) + "\\n",',
      ");",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(root, "pnpm"),
    `#!/usr/bin/env node\nrequire(${JSON.stringify(implementation)});\n`,
    { mode: 0o755 },
  );
  writeFileSync(join(root, "pnpm.cmd"), `@node "${implementation}" %*\r\n`);
  return root;
}

function createRenderFixture(count: number, failFormat = false) {
  const root = mkdtempSync(join(tmpdir(), "croco-api-format-"));
  TEMP_ROOTS.push(root);
  const docs = join(root, "packages", "docs");
  const scripts = join(docs, "scripts");
  const temporary = join(root, "long-temporary-prefix-".repeat(6));
  const output = join(docs, ".turbo", "docs-api", "rendered");
  const neighbor = join(docs, "neighbor.md");
  const log = join(root, "calls.jsonl");
  mkdirSync(scripts, { recursive: true });
  mkdirSync(temporary);
  mkdirSync(output, { recursive: true });
  mkdirSync(join(docs, "node_modules"));
  mkdirSync(join(docs, "src"));
  writeFileSync(join(docs, "src", "content.config.ts"), "");
  writeFileSync(join(output, "previous.md"), "previous\n");
  writeFileSync(neighbor, "# Neighbor  \n");
  for (const script of ["build-docs.mts", "move-build-output.mts"]) {
    cpSync(join(REPOSITORY_ROOT, "packages", "docs", "scripts", script), join(scripts, script));
  }
  const fake = join(root, "pnpm-fake.cjs");
  writeFileSync(
    fake,
    `
    const { appendFileSync, mkdirSync, writeFileSync } = require("node:fs");
    const { join } = require("node:path");
    const { spawnSync } = require("node:child_process");
    const args = process.argv.slice(2);
    const buildRoot = process.env.CROCO_DOCS_BUILD_ROOT;
    appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, buildRoot }) + "\\n");
    if (args[1] === "astro") {
      const api = join(buildRoot, "src", "content", "docs", "api");
      for (let index = 0; index < ${count}; index++) {
        const folder = join(api, "package-" + (index % 3), "src", "classes");
        mkdirSync(folder, { recursive: true });
        writeFileSync(join(folder, "Document" + index + ".md"), "# Generated\\n\\n-   value\\n");
      }
    } else if (args[1] === "oxfmt") {
      if (${failFormat}) process.exit(23);
      const result = spawnSync(${JSON.stringify(join(REPOSITORY_ROOT, "node_modules", ".bin", "oxfmt"))}, args.slice(2), { stdio: "inherit" });
      if (result.error) throw result.error;
      process.exit(result.status ?? 1);
    } else { process.exit(99); }
  `,
  );
  writeFileSync(join(root, "pnpm"), `#!/usr/bin/env node\nrequire(${JSON.stringify(fake)});\n`, {
    mode: 0o755,
  });
  writeFileSync(join(root, "pnpm.cmd"), `@node "${fake}" %*\r\n`);
  return {
    output,
    neighbor,
    temporary,
    calls: () =>
      readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map(
          (line) =>
            JSON.parse(line) as {
              args: string[];
              buildRoot?: string;
            },
        ),
    run: () =>
      spawnSync(
        process.execPath,
        ["--experimental-strip-types", join(scripts, "build-docs.mts"), "--api-render"],
        {
          cwd: docs,
          encoding: "utf8",
          env: {
            ...process.env,
            TMPDIR: temporary,
            TMP: temporary,
            TEMP: temporary,
            TURBO_HASH: "render-fixture",
            PATH: `${root}${delimiter}${process.env.PATH ?? ""}`,
          },
        },
      ),
  };
}
