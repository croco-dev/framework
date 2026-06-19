import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runStaticMisuseChecks } from "../static-misuse-check.mts";

const tempRepos: string[] = [];

describe("static-misuse-check.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("flags repository-core imports of Drizzle implementation packages", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      'import { drizzle } from "drizzle-orm/node-postgres";\nexport const value = drizzle;\n',
    );

    const [result] = runStaticMisuseChecks(repo);

    expect(result).toEqual(
      expect.objectContaining({
        code: "CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY",
        id: "repository-core-implementation-boundary",
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        action: expect.stringContaining("@croco/tx-drizzle"),
        code: "CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY",
        file: "packages/repository-core/src/index.ts",
        line: 1,
        message: "@croco/repository-core cannot import drizzle-orm directly.",
      }),
    ]);
  });

  it("flags repository-core imports of tx-drizzle", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/repository-core/src/libs/Repository.ts",
      'export { AbstractDrizzleRepository } from "@croco/tx-drizzle";\n',
    );

    const [result] = runStaticMisuseChecks(repo);

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        file: "packages/repository-core/src/libs/Repository.ts",
        message: "@croco/repository-core cannot import @croco/tx-drizzle.",
      }),
    ]);
  });

  it("honors an explicit next-line escape hatch", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      [
        "// croco-static-misuse-ignore-next-line CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY -- fixture proves the checker escape hatch",
        'import { drizzle } from "drizzle-orm";',
        "",
      ].join("\n"),
    );

    const [result] = runStaticMisuseChecks(repo);

    expect(result).toEqual(
      expect.objectContaining({
        status: "pass",
        diagnostics: [],
      }),
    );
  });

  it("does not flag ordinary text that mentions Drizzle without an implementation import", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      'export const note = "Drizzle belongs in the implementation package";\n',
    );

    const [result] = runStaticMisuseChecks(repo);

    expect(result?.status).toBe("pass");
  });
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-static-misuse-"));
  tempRepos.push(repo);
  mkdirSync(join(repo, "packages", "repository-core", "src"), { recursive: true });
  return repo;
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}
