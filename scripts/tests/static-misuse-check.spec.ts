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

  it("flags REST parameter decorators on overloaded method implementations", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/UsersController.ts",
      [
        'import { Query } from "@croco/protocols-rest";',
        "declare const listUsers: object;",
        "export class UsersController {",
        "  list(page: number): void;",
        '  list(@Query(listUsers, "page") page: any): void {',
        "    void page;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-parameter-decorator-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        code: "CROCO_STATIC_REST_OVERLOADED_PARAMETER_DECORATOR_BOUNDARY",
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        file: "packages/protocols-rest/src/controllers/UsersController.ts",
        line: 5,
        message: expect.stringContaining("hides the decorated implementation annotation"),
      }),
    ]);
  });

  it("resolves aliased and namespace REST decorators on overloaded methods", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/AliasedUsersController.ts",
      [
        'import { Query as RestQuery } from "@croco/protocols-rest";',
        'import * as rest from "@croco/protocols-rest";',
        "declare const listUsers: object;",
        "export class UsersController {",
        "  list(page: number): void;",
        '  list(@RestQuery(listUsers, "page") page: any): void { void page; }',
        "  search(page: number): void;",
        '  search(@rest.Query(listUsers, "page") page: any): void { void page; }',
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-parameter-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({ line: 6 }),
      expect.objectContaining({ line: 8 }),
    ]);
  });

  it("flags Body with a local route contract on overloaded methods", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/CreateUserController.ts",
      [
        'import { Body, defineRouteContract } from "@croco/protocols-rest";',
        "const createUser = defineRouteContract({});",
        "export class UsersController {",
        "  create(body: { name: string }): void;",
        "  create(@Body(createUser) body: any): void { void body; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-parameter-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        line: 5,
        message: expect.stringContaining("hides the decorated implementation annotation"),
      }),
    ]);
  });

  it("allows loose schema overloads and unrelated same-name decorators", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/LooseUsersController.ts",
      [
        'import { Body, Query } from "@croco/protocols-rest";',
        'import { z } from "zod";',
        "export class UsersController {",
        "  list(page: number): void;",
        '  list(@Query("page", z.coerce.number()) page: number): void { void page; }',
        "  create(body: { name: string }): void;",
        "  create(@Body(z.object({ name: z.string() })) body: { name: string }): void { void body; }",
        "}",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/UnrelatedController.ts",
      [
        "function Query(_contract: object, _key: string): ParameterDecorator {",
        "  return () => undefined;",
        "}",
        "export class UnrelatedController {",
        "  list(page: number): void;",
        '  list(@Query({}, "page") page: any): void { void page; }',
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-parameter-decorator-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        diagnostics: [],
        status: "pass",
      }),
    );
  });

  it("allows REST parameter decorators on non-overloaded public methods", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/UsersController.ts",
      [
        'import { Query } from "@croco/protocols-rest";',
        "declare const listUsers: object;",
        "export class UsersController {",
        '  list(@Query(listUsers, "page") page: number): void {',
        "    void page;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-parameter-decorator-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        diagnostics: [],
        status: "pass",
      }),
    );
  });

  it("flags response-bearing route contracts on single-overload method implementations", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/UsersController.ts",
      [
        'import { defineRouteContract, Get, HttpMethod } from "@croco/protocols-rest";',
        "const getUser = defineRouteContract({ method: HttpMethod.GET, path: '/users/:id', response: schema() });",
        "export class UsersController {",
        "  getUser(): string;",
        "  @Get(getUser)",
        "  getUser(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        code: "CROCO_STATIC_REST_OVERLOADED_CONTRACT_ROUTE_DECORATOR_BOUNDARY",
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        file: "packages/protocols-rest/src/controllers/UsersController.ts",
        line: 5,
        message: expect.stringContaining("hides the decorated implementation return annotation"),
      }),
    ]);
  });

  it("resolves namespace decorators, contract factory aliases, and response spreads", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/SpreadUsersController.ts",
      [
        'import { defineRouteContract as define, HttpMethod } from "@croco/protocols-rest";',
        'import * as rest from "@croco/protocols-rest";',
        "const responseOptions = { response: schema() };",
        "const getUser = define({ method: HttpMethod.GET, path: '/users/:id', ...responseOptions });",
        "export class UsersController {",
        "  getUser(): string;",
        "  @rest.Get(getUser)",
        "  getUser(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        line: 7,
        message: expect.stringContaining("response-bearing route contracts"),
      }),
    ]);
  });

  it("rejects call-initialized response spreads", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/AssignedUsersController.ts",
      [
        'import { defineRouteContract, Get, HttpMethod } from "@croco/protocols-rest";',
        "const responseOptions = Object.assign({}, { response: schema() });",
        "const getUser = defineRouteContract({ method: HttpMethod.GET, path: '/users/:id', ...responseOptions });",
        "export class UsersController {",
        "  getUser(): string;",
        "  @Get(getUser)",
        "  getUser(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        line: 6,
        message: expect.stringContaining("response-bearing route contracts"),
      }),
    ]);
  });

  it("resolves namespace and decorator factory alias chains", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/AliasedUsersController.ts",
      [
        'import { defineRouteContract, HttpMethod } from "@croco/protocols-rest";',
        'import * as rest from "@croco/protocols-rest";',
        "const routes = rest;",
        "const Read = rest.Get;",
        "const { Get } = routes;",
        "const getUser = defineRouteContract({ method: HttpMethod.GET, path: '/users/:id', response: schema() });",
        "const route = rest.Get(getUser);",
        "const decorators = { route };",
        "export class UsersController {",
        "  namespaceAlias(): string;",
        "  @routes.Get(getUser)",
        "  namespaceAlias(): string | number { return 1; }",
        "  factoryAlias(): string;",
        "  @Read(getUser)",
        "  factoryAlias(): string | number { return 1; }",
        "  destructuredAlias(): string;",
        "  @Get(getUser)",
        "  destructuredAlias(): string | number { return 1; }",
        "  propertyBound(): string;",
        "  @decorators.route",
        "  propertyBound(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({ line: 11 }),
      expect.objectContaining({ line: 14 }),
      expect.objectContaining({ line: 17 }),
      expect.objectContaining({ line: 20 }),
    ]);
  });

  it("resolves package barrel re-exports and function-local namespace destructuring", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/routes.ts",
      'export * from "@croco/protocols-rest";\n',
    );
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/BarrelUsersController.ts",
      [
        'import { defineRouteContract, HttpMethod } from "@croco/protocols-rest";',
        'import * as rest from "@croco/protocols-rest";',
        'import { Get, Get as Read } from "./routes";',
        "const getUser = defineRouteContract({ method: HttpMethod.GET, path: '/users/:id', response: schema() });",
        "export function createControllers() {",
        "  const routes = rest;",
        "  const { Get } = routes;",
        "  class UsersController {",
        "    barrel(): string;",
        "    @Read(getUser)",
        "    barrel(): string | number { return 1; }",
        "    local(): string;",
        "    @Get(getUser)",
        "    local(): string | number { return 1; }",
        "  }",
        "  return UsersController;",
        "}",
        "export function unrelated(Get: (value: unknown) => MethodDecorator) {",
        "  class OtherController {",
        "    route(): string;",
        "    @Get({ response: schema() })",
        "    route(): string | number { return 1; }",
        "  }",
        "  return OtherController;",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({ line: 10 }),
      expect.objectContaining({ line: 13 }),
    ]);
  });

  it("uses lexical symbols for function-local route aliases and contracts", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/LocalUsersController.ts",
      [
        'import { defineRouteContract, Get, HttpMethod } from "@croco/protocols-rest";',
        'import * as rest from "@croco/protocols-rest";',
        "export function createControllers() {",
        "  const responseContract = defineRouteContract({ method: HttpMethod.GET, path: '/users', response: schema() });",
        "  const responseLess = defineRouteContract({ method: HttpMethod.GET, path: '/health' });",
        "  const base = { query: schema() };",
        "  const spreadResponseLess = defineRouteContract({ method: HttpMethod.GET, path: '/spread', ...base });",
        "  const response = undefined;",
        "  const undefinedResponse = defineRouteContract({ method: HttpMethod.GET, path: '/undefined', response });",
        "  const define = defineRouteContract;",
        "  const aliasedResponseLess = define({ method: HttpMethod.GET, path: '/aliased' });",
        "  const ConditionalRead = true ? Get : Get;",
        "  const Read = rest.Get;",
        "  const route = Get(responseContract);",
        "  const decorators = { route };",
        "  class UsersController {",
        "    factory(): string;",
        "    @Read(responseContract)",
        "    factory(): string | number { return 1; }",
        "    bound(): string;",
        "    @route",
        "    bound(): string | number { return 1; }",
        "    property(): string;",
        "    @decorators.route",
        "    property(): string | number { return 1; }",
        "    conditional(): string;",
        "    @ConditionalRead(responseContract)",
        "    conditional(): string | number { return 1; }",
        "    loose(): string;",
        "    @Get(responseLess)",
        "    loose(): string | number { return 1; }",
        "    spread(): string;",
        "    @Get(spreadResponseLess)",
        "    spread(): string | number { return 1; }",
        "    undefinedResponse(): string;",
        "    @Get(undefinedResponse)",
        "    undefinedResponse(): string | number { return 1; }",
        "    aliasedResponseLess(): string;",
        "    @Get(aliasedResponseLess)",
        "    aliasedResponseLess(): string | number { return 1; }",
        "  }",
        "  return UsersController;",
        "}",
        "export function unrelated(Get: (value: unknown) => MethodDecorator) {",
        "  class OtherController {",
        "    route(): string;",
        "    @Get({ response: schema() })",
        "    route(): string | number { return 1; }",
        "  }",
        "  return OtherController;",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({ line: 18 }),
      expect.objectContaining({ line: 21 }),
      expect.objectContaining({ line: 24 }),
      expect.objectContaining({ line: 27 }),
    ]);
  });

  it("resolves literal element-access route decorators", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/ElementUsersController.ts",
      [
        'import { defineRouteContract, Get, HttpMethod } from "@croco/protocols-rest";',
        'import * as rest from "@croco/protocols-rest";',
        "const getUser = defineRouteContract({ method: HttpMethod.GET, path: '/users', response: schema() });",
        "const decorators = [Get(getUser)] as const;",
        "export class UsersController {",
        "  namespace(): string;",
        "  @(rest['Get'](getUser))",
        "  namespace(): string | number { return 1; }",
        "  bound(): string;",
        "  @(decorators[0])",
        "  bound(): string | number { return 1; }",
        "  'quoted'(): string;",
        "  @Get(getUser)",
        "  quoted(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({ line: 7 }),
      expect.objectContaining({ line: 10 }),
      expect.objectContaining({ line: 13 }),
    ]);
  });

  it("normalizes computed overload names and follows definite factory assignments", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/AssignedUsersController.ts",
      [
        'import { defineRouteContract, Get, HttpMethod } from "@croco/protocols-rest";',
        "const responseContract = defineRouteContract({ method: HttpMethod.GET, path: '/users', response: schema() });",
        "const responseLessA = defineRouteContract({ method: HttpMethod.GET, path: '/a' });",
        "const responseLessB = defineRouteContract({ method: HttpMethod.GET, path: '/b' });",
        "const conditionalResponseLess = true ? responseLessA : responseLessB;",
        "let Read: typeof Get;",
        "Read = Get;",
        "export class UsersController {",
        "  ['value'](): string;",
        "  @Get(responseContract)",
        "  value(): string | number { return 1; }",
        "  assigned(): string;",
        "  @Read(responseContract)",
        "  assigned(): string | number { return 1; }",
        "  conditional(): string;",
        "  @Get(conditionalResponseLess)",
        "  conditional(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({ line: 10 }),
      expect.objectContaining({ line: 13 }),
    ]);
  });

  it("fails closed for Object.assign when Object is shadowed", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/ShadowedObjectController.ts",
      [
        'import { defineRouteContract, Get, HttpMethod } from "@croco/protocols-rest";',
        "const Object = { assign: (..._values: object[]) => ({ response: schema() }) };",
        "const options = Object.assign({}, {});",
        "const getUser = defineRouteContract({ method: HttpMethod.GET, path: '/users/:id', ...options });",
        "export class UsersController {",
        "  getUser(): string;",
        "  @Get(getUser)",
        "  getUser(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        line: 7,
        message: expect.stringContaining("unresolved non-string route contract"),
      }),
    ]);
  });

  it("resolves prebound and namespace-destructured route decorators", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/BoundUsersController.ts",
      [
        'import { defineRouteContract, Get as Read, HttpMethod } from "@croco/protocols-rest";',
        'import * as rest from "@croco/protocols-rest";',
        "const { Get } = rest;",
        "const getUser = defineRouteContract({ method: HttpMethod.GET, path: '/users/:id', response: schema() });",
        "const boundRoute = Read(getUser);",
        "export class UsersController {",
        "  bound(): string;",
        "  @boundRoute",
        "  bound(): string | number { return 1; }",
        "  destructured(): string;",
        "  @Get(getUser)",
        "  destructured(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({ line: 8 }),
      expect.objectContaining({ line: 11 }),
    ]);
  });

  it("resolves chained prebound decorators and nested conditional factory aliases", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/ChainedUsersController.ts",
      [
        'import { defineRouteContract, Get, HttpMethod } from "@croco/protocols-rest";',
        "const responseContract = defineRouteContract({ method: HttpMethod.GET, path: '/users', response: schema() });",
        "const route = Get(responseContract);",
        "const aliasedRoute = route;",
        "const Read = true ? (false ? Get : Get) : Get;",
        "const conditionalRoute = true ? route : aliasedRoute;",
        "const decorators = [route] as const;",
        "const decoratorAliases = decorators;",
        "export class UsersController {",
        "  bound(): string;",
        "  @aliasedRoute",
        "  bound(): string | number { return 1; }",
        "  conditional(): string;",
        "  @Read(responseContract)",
        "  conditional(): string | number { return 1; }",
        "  conditionalBound(): string;",
        "  @conditionalRoute",
        "  conditionalBound(): string | number { return 1; }",
        "  collectionAlias(): string;",
        "  @(decoratorAliases[0])",
        "  collectionAlias(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({ line: 11 }),
      expect.objectContaining({ line: 14 }),
      expect.objectContaining({ line: 17 }),
      expect.objectContaining({ line: 20 }),
    ]);
  });

  it("uses the strict decorator type marker through generic identity wrappers", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/libs/decorators/contractDecoratorSignature.ts",
      [
        'declare module "@croco/protocols-rest" {',
        "  const contractMethodDecoratorBrand: unique symbol;",
        "  export const HttpMethod: { readonly GET: 'GET' };",
        "  export function defineRouteContract<const Contract extends object>(contract: Contract): Contract;",
        "  type ResponseMember<Contract> = Contract extends { response: unknown } ? Contract : never;",
        "  type StrictDecorator<Expected> = MethodDecorator & { readonly [contractMethodDecoratorBrand]?: Expected };",
        "  type RouteDecorator<Contract> = [ResponseMember<Contract>] extends [never] ? MethodDecorator : StrictDecorator<ResponseMember<Contract>>;",
        "  export function Get<const Contract extends object>(contract: Contract): RouteDecorator<Contract>;",
        "}",
        "declare function schema(): unknown;",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/WrappedUsersController.ts",
      [
        'import { defineRouteContract, Get, HttpMethod } from "@croco/protocols-rest";',
        "const responseContract = defineRouteContract({ method: HttpMethod.GET, path: '/users', response: schema() });",
        "const responseLess = defineRouteContract({ method: HttpMethod.GET, path: '/health' });",
        "const mixed = true ? responseContract : responseLess;",
        "const identity = <Value>(value: Value): Value => value;",
        "const route = identity(Get(responseContract));",
        "const custom = Object.assign((..._args: unknown[]) => undefined, { __crocoContractMethodDecorator: 'unrelated' });",
        "export class UsersController {",
        "  value(): string;",
        "  @route",
        "  value(): string | number { return 1; }",
        "  health(): string;",
        "  @Get(identity(responseLess))",
        "  health(): string | number { return 1; }",
        "  mixed(): string;",
        "  @Get(identity(mixed))",
        "  mixed(): string | number { return 1; }",
        "  custom(): string;",
        "  @custom",
        "  custom(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({ line: 10 }),
      expect.objectContaining({ line: 16 }),
    ]);
  });

  it("rejects unresolved non-string routes on overloaded methods", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/DynamicUsersController.ts",
      [
        'import { Get } from "@croco/protocols-rest";',
        "declare const dynamicContract: object;",
        "export class UsersController {",
        "  getUser(): string;",
        "  @Get(dynamicContract)",
        "  getUser(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        line: 5,
        message: expect.stringContaining("unresolved non-string route contract"),
      }),
    ]);
  });

  it("allows loose and response-less route decorators on overloaded methods", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/paths.ts",
      "export type ImportedRoutePath = string;\n",
    );
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/LooseUsersController.ts",
      [
        'import { defineRouteContract, Get, HttpMethod } from "@croco/protocols-rest";',
        'import type { ImportedRoutePath } from "./paths";',
        "const responseLess = defineRouteContract({ method: HttpMethod.GET, path: '/users' });",
        "const explicitUndefined = defineRouteContract({ method: HttpMethod.GET, path: '/explicit', response: undefined });",
        "const responseKey = 'response';",
        "const computedUndefined = defineRouteContract({ method: HttpMethod.GET, path: '/computed', [responseKey]: undefined });",
        "const responseLessOptions = Object.assign({}, { query: schema() });",
        "const assignedResponseLess = defineRouteContract({ method: HttpMethod.GET, path: '/assigned', ...responseLessOptions });",
        "const repeatedBase = { query: schema() };",
        "const repeatedSpread = defineRouteContract({ method: HttpMethod.GET, path: '/repeated-spread', ...repeatedBase, ...repeatedBase });",
        "const repeatedAssignedOptions = Object.assign({}, repeatedBase, repeatedBase);",
        "const repeatedAssigned = defineRouteContract({ method: HttpMethod.GET, path: '/repeated-assigned', ...repeatedAssignedOptions });",
        "type RoutePath = string;",
        "type BrandedRoutePath = string & { readonly __brand: 'RoutePath' };",
        "declare const aliasedPath: RoutePath;",
        "declare const brandedPath: BrandedRoutePath;",
        "declare const importedPath: ImportedRoutePath;",
        "declare const dynamicPath: string;",
        "declare const segment: string;",
        "declare function routePath(): string;",
        "interface Paths { users: string }",
        "declare const paths: Paths;",
        "const arrowPath = (): string => '/arrow';",
        "export class UsersController {",
        "  loose(): string;",
        '  @Get("/users")',
        "  loose(): string | number { return 1; }",
        "  responseLess(): string;",
        "  @Get(responseLess)",
        "  responseLess(): string | number { return 1; }",
        "  explicitUndefined(): string;",
        "  @Get(explicitUndefined)",
        "  explicitUndefined(): string | number { return 1; }",
        "  computedUndefined(): string;",
        "  @Get(computedUndefined)",
        "  computedUndefined(): string | number { return 1; }",
        "  inlineResponseLess(): string;",
        "  @Get(defineRouteContract({ method: HttpMethod.GET, path: '/inline' }))",
        "  inlineResponseLess(): string | number { return 1; }",
        "  dynamicString(): string;",
        "  @Get(dynamicPath)",
        "  dynamicString(): string | number { return 1; }",
        "  templateString(): string;",
        "  @Get(`/users/${segment}`)",
        "  templateString(): string | number { return 1; }",
        "  aliasedString(): string;",
        "  @Get(aliasedPath)",
        "  aliasedString(): string | number { return 1; }",
        "  functionString(): string;",
        "  @Get(routePath())",
        "  functionString(): string | number { return 1; }",
        "  propertyString(): string;",
        "  @Get(paths.users)",
        "  propertyString(): string | number { return 1; }",
        "  importedString(): string;",
        "  @Get(importedPath)",
        "  importedString(): string | number { return 1; }",
        "  arrowString(): string;",
        "  @Get(arrowPath())",
        "  arrowString(): string | number { return 1; }",
        "  brandedString(): string;",
        "  @Get(brandedPath)",
        "  brandedString(): string | number { return 1; }",
        "  stringConstructor(): string;",
        "  @Get(String('/users'))",
        "  stringConstructor(): string | number { return 1; }",
        "  stringMethod(): string;",
        "  @Get('/users'.toUpperCase())",
        "  stringMethod(): string | number { return 1; }",
        "  assignedResponseLess(): string;",
        "  @Get(assignedResponseLess)",
        "  assignedResponseLess(): string | number { return 1; }",
        "  repeatedSpread(): string;",
        "  @Get(repeatedSpread)",
        "  repeatedSpread(): string | number { return 1; }",
        "  repeatedAssigned(): string;",
        "  @Get(repeatedAssigned)",
        "  repeatedAssigned(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        diagnostics: [],
        status: "pass",
      }),
    );
  });

  it("allows response-less contracts through properties, elements, and inline conditionals", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/protocols-rest/src/controllers/IndirectHealthController.ts",
      [
        'import { defineRouteContract, Get, HttpMethod } from "@croco/protocols-rest";',
        "const healthA = defineRouteContract({ method: HttpMethod.GET, path: '/health/a' });",
        "const healthB = defineRouteContract({ method: HttpMethod.GET, path: '/health/b' });",
        "const routes = { health: healthA };",
        "const routeList = [healthA] as const;",
        "const routeAliases = routeList;",
        "let assignedAliases: typeof routeList;",
        "assignedAliases = routeList;",
        "export class HealthController {",
        "  property(): string;",
        "  @Get(routes.health)",
        "  property(): string | number { return 1; }",
        "  element(): string;",
        "  @Get(routeList[0])",
        "  element(): string | number { return 1; }",
        "  aliasedElement(): string;",
        "  @Get(routeAliases[0])",
        "  aliasedElement(): string | number { return 1; }",
        "  assignedElement(): string;",
        "  @Get(assignedAliases[0])",
        "  assignedElement(): string | number { return 1; }",
        "  conditional(): string;",
        "  @Get(true ? healthA : healthB)",
        "  conditional(): string | number { return 1; }",
        "}",
        "",
      ].join("\n"),
    );

    const result = findResult(repo, "rest-overloaded-contract-route-decorator-boundary");

    expect(result).toEqual(
      expect.objectContaining({
        diagnostics: [],
        status: "pass",
      }),
    );
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
          baselineEntryCount: 1,
          entries: [
            {
              package: "@croco/internal-runtime",
              file: "packages/internal-runtime/src/index.ts",
              line: 2,
              excerpt: 'throw new Error("internal invariant");',
              reason:
                "Internal programmer assertion that is not exposed as a runtime recovery boundary.",
              owner: "framework-error-handling",
              expiresOn: "2099-12-31",
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

  it("rejects raw-error allowlist entries without expiration metadata", () => {
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
          baselineEntryCount: 1,
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
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        file: "scripts/static-misuse-raw-error-allowlist.json",
        message: expect.stringContaining("expiresOn must be a valid YYYY-MM-DD date"),
      }),
      expect.objectContaining({
        file: "packages/internal-runtime/src/index.ts",
        line: 2,
      }),
    ]);
  });

  it("rejects stale raw-error allowlist entries", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/internal-runtime/package.json",
      JSON.stringify({ name: "@croco/internal-runtime" }),
    );
    writeFile(
      repo,
      "packages/internal-runtime/src/index.ts",
      'export function fail(): never {\n  throw new Error("stale");\n}\n',
    );
    writeFile(
      repo,
      "scripts/static-misuse-raw-error-allowlist.json",
      JSON.stringify({
        schemaVersion: 1,
        baselineEntryCount: 1,
        entries: [
          {
            package: "@croco/internal-runtime",
            file: "packages/internal-runtime/src/index.ts",
            line: 2,
            excerpt: 'throw new Error("stale");',
            reason: "Temporary fixture exception.",
            owner: "framework-error-handling",
            expiresOn: "2000-01-01",
          },
        ],
      }),
    );

    const result = findResult(repo, "raw-error-runtime-boundary");

    expect(result?.status).toBe("fail");
    expect(result?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("expiresOn is stale") }),
      ]),
    );
  });

  it("requires an owner even when a raw-error allowlist entry has a future expiry", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/internal-runtime/package.json",
      JSON.stringify({ name: "@croco/internal-runtime" }),
    );
    writeFile(
      repo,
      "packages/internal-runtime/src/index.ts",
      'export function fail(): never {\n  throw new Error("unowned");\n}\n',
    );
    writeFile(
      repo,
      "scripts/static-misuse-raw-error-allowlist.json",
      JSON.stringify({
        schemaVersion: 1,
        baselineEntryCount: 1,
        entries: [
          {
            package: "@croco/internal-runtime",
            file: "packages/internal-runtime/src/index.ts",
            line: 2,
            excerpt: 'throw new Error("unowned");',
            reason: "Temporary fixture exception.",
            expiresOn: "2099-12-31",
          },
        ],
      }),
    );

    const result = findResult(repo, "raw-error-runtime-boundary");

    expect(result?.status).toBe("fail");
    expect(result?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("owner must be a non-empty string"),
        }),
      ]),
    );
  });

  it("rejects allowlist entry growth without a baseline count update", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/internal-runtime/package.json",
      JSON.stringify({ name: "@croco/internal-runtime" }),
    );
    writeFile(
      repo,
      "packages/internal-runtime/src/index.ts",
      'export function fail(): never {\n  throw new Error("new suppression");\n}\n',
    );
    writeFile(
      repo,
      "scripts/static-misuse-raw-error-allowlist.json",
      JSON.stringify({
        schemaVersion: 1,
        baselineEntryCount: 0,
        entries: [
          {
            package: "@croco/internal-runtime",
            file: "packages/internal-runtime/src/index.ts",
            line: 2,
            excerpt: 'throw new Error("new suppression");',
            reason: "Temporary fixture exception.",
            owner: "framework-error-handling",
            expiresOn: "2099-12-31",
          },
        ],
      }),
    );

    const result = findResult(repo, "raw-error-runtime-boundary");

    expect(result?.status).toBe("fail");
    expect(result?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Static misuse allowlist has 1 entries but baselineEntryCount is 0.",
        }),
      ]),
    );
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
          baselineEntryCount: 1,
          entries: [
            {
              package: "@croco/runtime-boundary",
              file: "packages/runtime-boundary/src/index.ts",
              line: 4,
              excerpt: "} catch {",
              reason:
                "Telemetry delivery is best-effort and must not replace the primary runtime outcome.",
              owner: "framework-error-handling",
              expiresOn: "2099-12-31",
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

  it("rejects empty-catch allowlist entries without expiration metadata", () => {
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
          baselineEntryCount: 1,
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
        status: "fail",
      }),
    );
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        file: "scripts/static-misuse-empty-catch-allowlist.json",
        message: expect.stringContaining("expiresOn must be a valid YYYY-MM-DD date"),
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
