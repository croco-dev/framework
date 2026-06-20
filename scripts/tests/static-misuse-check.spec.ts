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

  it("flags @All routes in generated app templates", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/create-croco-app/templates/saas/apps/api-server/src/controllers/WebhookController.ts",
      [
        'import { All, Controller } from "@croco/protocols-rest";',
        '@Controller("/webhooks")',
        "export class WebhookController {",
        '  @All("/:id")',
        "  handle() {}",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-generated-contract-schema-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        code: "CROCO_STATIC_REST_GENERATED_CONTRACT_SCHEMA_BOUNDARY",
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        file: "packages/create-croco-app/templates/saas/apps/api-server/src/controllers/WebhookController.ts",
        line: 4,
        message: "@All cannot be used in generated REST contract routes.",
      }),
    ]);
  });

  it("flags schema-less body and named parameter decorators in generated app templates", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/create-croco-app/templates/saas/apps/api-server/src/controllers/UsersController.ts",
      [
        'import { Body, Controller, Param, Post, Query } from "@croco/protocols-rest";',
        '@Controller("/users")',
        "export class UsersController {",
        '  @Post("/:id")',
        "  update(",
        '    @Param("id") id: string,',
        '    @Query("include") include: string,',
        "    @Body() body: unknown,",
        "  ) {",
        "    return { id, include, body };",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-generated-contract-schema-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        line: 6,
        message:
          "Named REST parameter decorators in generated contract routes must include schemas.",
      }),
      expect.objectContaining({
        line: 7,
        message:
          "Named REST parameter decorators in generated contract routes must include schemas.",
      }),
      expect.objectContaining({
        line: 8,
        message: "@Body() in generated REST contract routes must include a schema.",
      }),
    ]);
  });

  it("passes generated app templates with schema-backed REST decorators", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/create-croco-app/templates/saas/apps/api-server/src/controllers/UsersController.ts",
      [
        'import { Body, Controller, Param, Post, Query } from "@croco/protocols-rest";',
        'import { z } from "zod";',
        "const bodySchema = z.object({ name: z.string() });",
        "const idSchema = z.string().min(1);",
        "const includeSchema = z.string().optional();",
        '@Controller("/users")',
        "export class UsersController {",
        '  @Post("/:id")',
        '  update(@Param("id", idSchema) id: string, @Query("include", includeSchema) include: string, @Body(bodySchema) body: unknown) {',
        "    return { id, include, body };",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-generated-contract-schema-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        status: "pass",
        diagnostics: [],
      }),
    );
  });

  it("honors the REST contract rule escape hatch on a single generated-template line", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/create-croco-app/templates/saas/apps/api-server/src/controllers/UsersController.ts",
      [
        'import { Body, Controller, Post } from "@croco/protocols-rest";',
        '@Controller("/users")',
        "export class UsersController {",
        "  @Post()",
        "  // croco-static-misuse-ignore-next-line CROCO_STATIC_REST_GENERATED_CONTRACT_SCHEMA_BOUNDARY -- fixture proves reviewed loose-mode escape",
        "  update(@Body() body: unknown) {",
        "    return body;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-generated-contract-schema-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        status: "pass",
        diagnostics: [],
      }),
    );
  });
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-static-misuse-"));
  tempRepos.push(repo);
  mkdirSync(join(repo, "packages", "repository-core", "src"), { recursive: true });
  mkdirSync(join(repo, "packages", "create-croco-app", "templates"), { recursive: true });
  return repo;
}

function findResult(repo: string, id: string) {
  return runStaticMisuseChecks(repo).find((result) => result.id === id);
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}
