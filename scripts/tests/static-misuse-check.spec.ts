import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { runStaticMisuseChecks } from "../static-misuse-check.mts";

const tempRepos: string[] = [];
const staticMisuseScriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "static-misuse-check.mts",
);

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

  it("ignores generated REST decorator mentions in line comments", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/create-croco-app/templates/saas/apps/api-server/src/controllers/UsersController.ts",
      [
        'import { Body, Controller, Post } from "@croco/protocols-rest";',
        'import { z } from "zod";',
        "const bodySchema = z.object({ name: z.string() });",
        '@Controller("/users")',
        "export class UsersController {",
        "  @Post()",
        "  update(@Body(bodySchema) body: unknown) {",
        "    // mention @All() and @Body() in a maintenance note without tripping the gate",
        '    return { body, note: "@Param(\\"id\\") belongs in docs" };',
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

  it("rejects inconsistent REST contract graphs with stable recovery diagnostics", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/example/src/contracts.ts",
      [
        'import { defineRouteContract, HttpMethod } from "@croco/protocols-rest";',
        "export const UserSchema = schema();",
        "export const OrderSchema = schema();",
        "export const GetUser = defineRouteContract({ method: HttpMethod.GET, path: '/users/:id', params: objectSchema(), response: UserSchema });",
        "export const GetOrder = defineRouteContract({ method: HttpMethod.GET, path: '/orders/:id', params: objectSchema(), response: OrderSchema });",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "packages/example/src/controller.ts",
      [
        'import { Get, Param as RouteParam, ResponseSchema } from "@croco/protocols-rest";',
        'import { GetOrder, GetUser, OrderSchema } from "./contracts.js";',
        "class BaseUsersController {",
        "  @Get(GetUser)",
        '  inherited(@RouteParam(GetUser, "id") id: string) {',
        "    return id;",
        "  }",
        "}",
        "class MiddleUsersController extends BaseUsersController {}",
        "class UsersController extends MiddleUsersController {",
        "  @Get(GetOrder)",
        '  inherited(@RouteParam(GetOrder, "id") id: string) {',
        "    return id;",
        "  }",
        "  @Get(GetUser)",
        "  @ResponseSchema(OrderSchema)",
        "  @Get(GetOrder)",
        '  find(@RouteParam(GetOrder, "id") id: string, @RouteParam(GetOrder, "id") duplicate: string) {',
        "    return { id, duplicate };",
        "  }",
        '  loose(@RouteParam(GetUser, "id") id: string) {',
        "    return id;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-decorator-contract-graph");

    expect(result?.status).toBe("fail");
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "REST_MULTIPLE_ROUTE_DECORATORS",
      "REST_DECORATOR_CONTRACT_MISMATCH",
      "REST_DUPLICATE_PARAMETER_BINDING",
      "REST_MULTIPLE_ROUTE_DECORATORS",
      "REST_DECORATOR_CONTRACT_MISMATCH",
      "REST_DECORATOR_CONTRACT_MISMATCH",
      "REST_DUPLICATE_PARAMETER_BINDING",
      "REST_RESPONSE_SCHEMA_CONFLICT",
      "REST_CONTRACT_BINDING_WITHOUT_ROUTE",
    ]);
    expect(result?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: expect.stringContaining("GetUser"),
          code: "REST_DECORATOR_CONTRACT_MISMATCH",
          file: "packages/example/src/controller.ts",
          line: 18,
          message: expect.stringContaining("find"),
        }),
        expect.objectContaining({
          code: "REST_DUPLICATE_PARAMETER_BINDING",
          line: 18,
        }),
        expect.objectContaining({
          code: "REST_RESPONSE_SCHEMA_CONFLICT",
          line: 16,
        }),
        expect.objectContaining({
          code: "REST_CONTRACT_BINDING_WITHOUT_ROUTE",
          line: 21,
        }),
      ]),
    );
  });

  it("accepts the same REST contract through named imports, aliases, and re-exports", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/example/src/contracts/user.ts",
      [
        'import { defineRouteContract, HttpMethod } from "@croco/protocols-rest";',
        "export const UserSchema = schema();",
        "export const GetUser = defineRouteContract({ method: HttpMethod.GET, path: '/users/:id', params: objectSchema(), response: UserSchema });",
        "",
      ].join("\n"),
    );
    writeFile(repo, "packages/example/src/contracts/index.ts", 'export * from "./user.js";\n');
    writeFile(
      repo,
      "packages/example/src/contracts/public.ts",
      'export { GetUser as UserRoute, UserSchema } from "./index.js";\n',
    );
    writeFile(
      repo,
      "packages/example/src/controller.ts",
      [
        'import { defineRouteContract, Get as Read, HttpMethod, Param, ResponseSchema } from "@croco/protocols-rest";',
        'import { UserRoute as Contract, UserSchema } from "./contracts/public.js";',
        "const LocalContract = defineRouteContract({ method: HttpMethod.GET, path: '/local/:id', params: objectSchema(), response: UserSchema });",
        "class BaseUsersController {",
        "  @Read(Contract)",
        '  inherited(@Param(Contract, "id") id: string) {',
        "    return { id };",
        "  }",
        "}",
        "class UsersController extends BaseUsersController {",
        "  @Read(LocalContract)",
        '  local(@Param(LocalContract, "id") id: string) {',
        "    return { id };",
        "  }",
        "  @ResponseSchema(Contract.response)",
        "  @Read(Contract)",
        '  find(@Param(Contract, "id") id: string) {',
        "    return { id };",
        "  }",
        "  @Read(Contract)",
        "  @ResponseSchema(UserSchema)",
        '  reordered(@Param(Contract, "id") id: string) {',
        "    return { id };",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-decorator-contract-graph");

    expect(result).toEqual(
      expect.objectContaining({
        diagnostics: [],
        status: "pass",
      }),
    );
  });

  it("distinguishes dynamic routes from statically loose string routes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/example/src/contracts.ts",
      [
        'import { defineRouteContract, HttpMethod } from "@croco/protocols-rest";',
        "export const GetUser = defineRouteContract({ method: HttpMethod.GET, path: '/users/:id', params: objectSchema(), response: schema() });",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "packages/example/src/controller.ts",
      [
        'import { Get, Param, ResponseSchema } from "@croco/protocols-rest";',
        'import { GetUser } from "./contracts.js";',
        "const dynamicRoute = makeRoute();",
        "const loosePath = '/loose/:id';",
        "class DynamicController {",
        "  @Get(dynamicRoute)",
        "  @ResponseSchema(makeSchema())",
        '  find(@Param(dynamicRoute, "id") id: string) {',
        "    return id;",
        "  }",
        "  @Get(makeRoute())",
        '  mixed(@Param(GetUser, "id") id: string) {',
        "    return id;",
        "  }",
        "  @Get(loosePath)",
        '  localLoose(@Param(GetUser, "id") id: string) {',
        "    return id;",
        "  }",
        '  @Get("/inline/:id")',
        '  inlineLoose(@Param(GetUser, "id") id: string) {',
        "    return id;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-decorator-contract-graph");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        code: "REST_CONTRACT_BINDING_WITHOUT_ROUTE",
        message: expect.stringContaining("localLoose"),
      }),
      expect.objectContaining({
        code: "REST_CONTRACT_BINDING_WITHOUT_ROUTE",
        message: expect.stringContaining("inlineLoose"),
      }),
    ]);
    expect(result?.limitation).toContain("Dynamically produced");
  });

  it("normalizes duplicate HTTP header binding names case-insensitively", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/example/src/controller.ts",
      [
        'import { Get, Header } from "@croco/protocols-rest";',
        "class HeaderController {",
        '  @Get("/headers")',
        '  read(@Header("X-Tenant-ID") first: string, @Header("x-tenant-id") second: string) {',
        "    return { first, second };",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-decorator-contract-graph");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        code: "REST_DUPLICATE_PARAMETER_BINDING",
        line: 4,
        message: expect.stringContaining("header:x-tenant-id"),
      }),
    ]);
  });

  it("flags raw built-in Error throws in production package source", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/runtime-boundary/package.json",
      JSON.stringify({ name: "@croco/runtime-boundary" }),
    );
    writeFile(
      repo,
      "packages/runtime-boundary/src/index.ts",
      [
        "export function loadRuntimeBoundary(): never {",
        '  throw new Error("raw runtime failure");',
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "raw-error-runtime-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        code: "CROCO_STATIC_RAW_ERROR_RUNTIME_BOUNDARY",
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        file: "packages/runtime-boundary/src/index.ts",
        line: 2,
        message:
          "Production package source cannot throw raw built-in Error subclasses at runtime boundaries.",
      }),
    ]);
  });

  it("does not flag raw built-in Error throws in package JavaScript test files", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/runtime-boundary/package.json",
      JSON.stringify({ name: "@croco/runtime-boundary" }),
    );
    writeFile(
      repo,
      "packages/runtime-boundary/src/index.spec.js",
      ["export function failFixture() {", '  throw new Error("raw test failure");', "}", ""].join(
        "\n",
      ),
    );
    writeFile(
      repo,
      "packages/runtime-boundary/src/widget.test.jsx",
      [
        "export function failWidgetFixture() {",
        '  throw new TypeError("raw jsx test failure");',
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "raw-error-runtime-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        status: "pass",
        diagnostics: [],
      }),
    );
  });

  it("honors reviewed raw-error allowlist entries for internal exceptions", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/internal-runtime/package.json",
      JSON.stringify({ name: "@croco/internal-runtime" }),
    );
    writeFile(
      repo,
      "packages/internal-runtime/src/index.ts",
      [
        "export function assertInternalInvariant(): never {",
        '  throw new Error("internal invariant");',
        "}",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "scripts/static-misuse-raw-error-allowlist.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          entries: [
            {
              package: "@croco/internal-runtime",
              file: "packages/internal-runtime/src/index.ts",
              line: 2,
              excerpt: 'throw new Error("internal invariant");',
              reason:
                "Internal programmer assertion that is not exposed as a runtime recovery boundary.",
              owner: "framework-error-handling",
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = findResult(repo, "raw-error-runtime-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        status: "pass",
        diagnostics: [],
      }),
    );
  });

  it("rejects raw-error allowlist entries without owner or expiration metadata", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/internal-runtime/package.json",
      JSON.stringify({ name: "@croco/internal-runtime" }),
    );
    writeFile(
      repo,
      "packages/internal-runtime/src/index.ts",
      [
        "export function assertInternalInvariant(): never {",
        '  throw new Error("internal invariant");',
        "}",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "scripts/static-misuse-raw-error-allowlist.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          entries: [
            {
              package: "@croco/internal-runtime",
              file: "packages/internal-runtime/src/index.ts",
              line: 2,
              excerpt: 'throw new Error("internal invariant");',
              reason:
                "Internal programmer assertion that is not exposed as a runtime recovery boundary.",
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = findResult(repo, "raw-error-runtime-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        file: "scripts/static-misuse-raw-error-allowlist.json",
        message: expect.stringContaining("owner or expiresOn must be provided"),
      }),
      expect.objectContaining({
        file: "packages/internal-runtime/src/index.ts",
        line: 2,
      }),
    ]);
  });

  it("flags empty catch blocks in production package source", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/runtime-boundary/package.json",
      JSON.stringify({ name: "@croco/runtime-boundary" }),
    );
    writeFile(
      repo,
      "packages/runtime-boundary/src/index.ts",
      [
        "export function swallowRuntimeFailure(risky: () => void): void {",
        "  try {",
        "    risky();",
        "  } catch {}",
        "",
        "  try {",
        "    risky();",
        "  } catch {",
        "    // comments are not reviewed failure evidence",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "empty-catch-runtime-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        code: "CROCO_STATIC_EMPTY_CATCH_RUNTIME_BOUNDARY",
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        file: "packages/runtime-boundary/src/index.ts",
        line: 4,
        message:
          "Production package source cannot use an empty catch block without reviewed failure evidence.",
      }),
      expect.objectContaining({
        file: "packages/runtime-boundary/src/index.ts",
        line: 8,
        message:
          "Production package source cannot use an empty catch block without reviewed failure evidence.",
      }),
    ]);
  });

  it("does not flag non-empty catch blocks or package test files", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/runtime-boundary/package.json",
      JSON.stringify({ name: "@croco/runtime-boundary" }),
    );
    writeFile(
      repo,
      "packages/runtime-boundary/src/index.ts",
      [
        "export function recoverRuntimeFailure(risky: () => void, report: (error: unknown) => void): void {",
        "  try {",
        "    risky();",
        "  } catch (error) {",
        "    report(error);",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "packages/runtime-boundary/src/index.spec.ts",
      [
        "export function swallowTestFailure(risky: () => void): void {",
        "  try {",
        "    risky();",
        "  } catch {",
        "    // test fixtures can model swallowed failures",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "empty-catch-runtime-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        status: "pass",
        diagnostics: [],
      }),
    );
  });

  it("honors reviewed empty-catch allowlist entries", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/runtime-boundary/package.json",
      JSON.stringify({ name: "@croco/runtime-boundary" }),
    );
    writeFile(
      repo,
      "packages/runtime-boundary/src/index.ts",
      [
        "export function bestEffortTelemetry(record: () => void): void {",
        "  try {",
        "    record();",
        "  } catch {",
        "    // telemetry must not replace the primary runtime outcome",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "scripts/static-misuse-empty-catch-allowlist.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          entries: [
            {
              package: "@croco/runtime-boundary",
              file: "packages/runtime-boundary/src/index.ts",
              line: 4,
              excerpt: "} catch {",
              reason:
                "Telemetry delivery is best-effort and must not replace the primary runtime outcome.",
              owner: "framework-error-handling",
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = findResult(repo, "empty-catch-runtime-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        status: "pass",
        diagnostics: [],
      }),
    );
  });

  it("rejects empty-catch allowlist entries without owner or expiration metadata", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/runtime-boundary/package.json",
      JSON.stringify({ name: "@croco/runtime-boundary" }),
    );
    writeFile(
      repo,
      "packages/runtime-boundary/src/index.ts",
      [
        "export function bestEffortTelemetry(record: () => void): void {",
        "  try {",
        "    record();",
        "  } catch {",
        "    // telemetry must not replace the primary runtime outcome",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "scripts/static-misuse-empty-catch-allowlist.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          entries: [
            {
              package: "@croco/runtime-boundary",
              file: "packages/runtime-boundary/src/index.ts",
              line: 4,
              excerpt: "} catch {",
              reason:
                "Telemetry delivery is best-effort and must not replace the primary runtime outcome.",
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = findResult(repo, "empty-catch-runtime-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        file: "scripts/static-misuse-empty-catch-allowlist.json",
        message: expect.stringContaining("owner or expiresOn must be provided"),
      }),
      expect.objectContaining({
        file: "packages/runtime-boundary/src/index.ts",
        line: 4,
      }),
    ]);
  });

  it("reports rule-neutral recovery for malformed empty-catch allowlists", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/runtime-boundary/package.json",
      JSON.stringify({ name: "@croco/runtime-boundary" }),
    );
    writeFile(
      repo,
      "packages/runtime-boundary/src/index.ts",
      "export function bestEffortTelemetry(record: () => void): void {\n  try {\n    record();\n  } catch {}\n}\n",
    );
    writeFile(repo, "scripts/static-misuse-empty-catch-allowlist.json", "{ invalid json");

    const result = findResult(repo, "empty-catch-runtime-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "Fix the allowlist JSON before relying on reviewed static misuse exceptions.",
          file: "scripts/static-misuse-empty-catch-allowlist.json",
          message: expect.stringContaining("Static misuse allowlist is not valid JSON"),
        }),
      ]),
    );
  });

  it("does not allow inline comments to suppress empty-catch diagnostics", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/runtime-boundary/package.json",
      JSON.stringify({ name: "@croco/runtime-boundary" }),
    );
    writeFile(
      repo,
      "packages/runtime-boundary/src/index.ts",
      [
        "export function swallowRuntimeFailure(risky: () => void): void {",
        "  try {",
        "    risky();",
        "  } catch { // croco-static-misuse-ignore-line CROCO_STATIC_EMPTY_CATCH_RUNTIME_BOUNDARY -- must use structured baseline",
        "    // comments are not reviewed failure evidence",
        "  }",
        "",
        "  try {",
        "    risky();",
        "    // croco-static-misuse-ignore-next-line CROCO_STATIC_EMPTY_CATCH_RUNTIME_BOUNDARY -- must use structured baseline",
        "  } catch {",
        "    // comments are not reviewed failure evidence",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "empty-catch-runtime-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        file: "packages/runtime-boundary/src/index.ts",
        line: 4,
      }),
      expect.objectContaining({
        file: "packages/runtime-boundary/src/index.ts",
        line: 11,
      }),
    ]);
  });

  it("reports structured baseline guidance for empty-catch CLI failures", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/runtime-boundary/package.json",
      JSON.stringify({ name: "@croco/runtime-boundary" }),
    );
    writeFile(
      repo,
      "packages/runtime-boundary/src/index.ts",
      [
        "export function swallowRuntimeFailure(risky: () => void): void {",
        "  try {",
        "    risky();",
        "  } catch {",
        "    // comments are not reviewed failure evidence",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = runStaticMisuseCli(repo);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "reviewed baseline: scripts/static-misuse-empty-catch-allowlist.json",
    );
    expect(result.output).not.toContain(
      "escape hatch: // croco-static-misuse-ignore-next-line CROCO_STATIC_EMPTY_CATCH_RUNTIME_BOUNDARY",
    );
  });

  it("keeps inline escape hatch guidance for line-oriented CLI failures", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      'import { drizzle } from "drizzle-orm/node-postgres";\nexport const value = drizzle;\n',
    );

    const result = runStaticMisuseCli(repo);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "escape hatch: // croco-static-misuse-ignore-next-line CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY",
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

function runStaticMisuseCli(repo: string): {
  readonly status: number | null;
  readonly output: string;
} {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", staticMisuseScriptPath, "--root", repo],
    {
      encoding: "utf8",
    },
  );

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
}
