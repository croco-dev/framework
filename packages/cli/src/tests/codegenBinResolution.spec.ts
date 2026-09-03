import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveOpenapiSpecBinFromEntry } from "../commands/codegenOpenapi.js";
import { resolveRpcCodegenBinFromEntry } from "../commands/codegenRpc.js";
import { resolveMigrationRunnerBinFromEntry } from "../commands/migrate.js";

type DelegatedBinResolver = (entry: string) => string;

const delegatedBinResolvers: readonly {
  readonly name: string;
  readonly resolve: DelegatedBinResolver;
}[] = [
  { name: "OpenAPI", resolve: resolveOpenapiSpecBinFromEntry },
  { name: "RPC", resolve: resolveRpcCodegenBinFromEntry },
  { name: "Migration", resolve: resolveMigrationRunnerBinFromEntry },
];

const validEntrypointFixtures = [
  { name: "workspace", entryPath: "src/index.ts" },
  { name: "packed CJS", entryPath: "dist/index.cjs" },
  { name: "packed ESM", entryPath: "dist/index.mjs" },
] as const;

describe.each(delegatedBinResolvers)("$name delegated binary resolution", ({ resolve }) => {
  let fixtureRoot: string;

  beforeAll(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), "croco-codegen-entrypoints-"));
    for (const fixture of validEntrypointFixtures) {
      createEntrypointFixture(fixture.name, fixture.entryPath, true);
    }
    createEntrypointFixture("missing-bin", "dist/index.js", false);
    createEntrypointFixture("malformed", "lib/index.js", true);
  });

  afterAll(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it.each(validEntrypointFixtures)("resolves the $name fixture", ({ name, entryPath }) => {
    const packageRoot = join(fixtureRoot, name);

    expect(resolve(join(packageRoot, entryPath))).toBe(join(packageRoot, "dist", "cli.js"));
  });

  it("rejects a package entry whose delegated binary is missing", () => {
    const packageRoot = join(fixtureRoot, "missing-bin");
    const entry = join(packageRoot, "dist", "index.js");
    const bin = join(packageRoot, "dist", "cli.js");

    expect(() => resolve(entry)).toThrow(
      `Unable to resolve delegated CLI binary from entrypoint '${entry}': expected '${bin}' to exist. Rebuild or reinstall the package before retrying.`,
    );
  });

  it("rejects a package entry outside the workspace and packed layouts", () => {
    const packageRoot = join(fixtureRoot, "malformed");
    const entry = join(packageRoot, "lib", "index.js");

    expect(() => resolve(entry)).toThrow(
      `Unable to resolve delegated CLI binary from entrypoint '${entry}': expected the entrypoint to be directly under 'src' or 'dist'. Rebuild or reinstall the package before retrying.`,
    );
  });

  function createEntrypointFixture(
    fixtureName: string,
    entryPath: string,
    includeBin: boolean,
  ): void {
    const packageRoot = join(fixtureRoot, fixtureName);
    const entry = join(packageRoot, entryPath);
    mkdirSync(dirname(entry), { recursive: true });
    writeFileSync(entry, "export {};\n");

    if (includeBin) {
      const bin = join(packageRoot, "dist", "cli.js");
      mkdirSync(dirname(bin), { recursive: true });
      writeFileSync(bin, "#!/usr/bin/env node\n");
    }
  }
});
