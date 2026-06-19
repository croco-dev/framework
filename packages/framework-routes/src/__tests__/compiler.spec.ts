import "reflect-metadata";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContractGraphDiagnosticError } from "@croco/protocols-core";
import { describe, expect, it } from "vitest";
import type { CompiledController } from "../compiler";
import {
  assertRouteRegistrationTable,
  compileRoutes,
  createRouteRegistrationTable,
  generateModule,
  generateRouteRegistrationCode,
} from "../compiler";

describe("compiler", () => {
  const mockControllers: readonly CompiledController[] = [
    {
      basePath: "/api",
      className: "SampleController",
      routes: [
        { method: "GET", path: "/hello", handlerName: "hello" },
        { method: "POST", path: "/users", handlerName: "createUser" },
      ],
    },
  ];

  it("generates registerRoutes function", () => {
    const code = generateModule(mockControllers);

    expect(code).toContain("function registerRoutes");
    expect(code).toContain("routeRegistrationTable");
    expect(code).toContain('"id": "SampleController.hello"');
    expect(code).toContain('"path": "/api/hello"');
    expect(code).toContain('"path": "/api/users"');
    expect(code).toContain("for (const route of routeRegistrationTable)");
  });

  it("generates an explicit table for all routes from controller metadata", () => {
    const table = createRouteRegistrationTable(mockControllers);

    expect(table).toEqual({
      version: "croco.route-registration-table.v1",
      category: "http.controller",
      entries: [
        {
          id: "SampleController.hello",
          method: "GET",
          path: "/api/hello",
          controllerName: "SampleController",
          controllerPath: "/api",
          handlerName: "hello",
        },
        {
          id: "SampleController.createUser",
          method: "POST",
          path: "/api/users",
          controllerName: "SampleController",
          controllerPath: "/api",
          handlerName: "createUser",
        },
      ],
    });

    const code = generateRouteRegistrationCode(mockControllers);

    expect(code).toContain("route compiled");
    expect(code).toContain('"id": "SampleController.hello"');
    expect(code).toContain('"id": "SampleController.createUser"');
  });

  it("handles empty controller list", () => {
    const code = generateModule([]);

    expect(code).toContain("function registerRoutes");
    expect(code).toContain("app)");
    expect(code).toContain("Object.freeze([])");
  });

  it("rejects duplicate method and path registrations before runtime", () => {
    const duplicateControllers: readonly CompiledController[] = [
      {
        basePath: "/api",
        className: "FirstController",
        routes: [{ method: "GET", path: "/users", handlerName: "listUsers" }],
      },
      {
        basePath: "/api",
        className: "SecondController",
        routes: [{ method: "GET", path: "/users", handlerName: "listUsersAgain" }],
      },
    ];

    expect(() => createRouteRegistrationTable(duplicateControllers)).toThrow(
      ContractGraphDiagnosticError,
    );
    expect(() => createRouteRegistrationTable(duplicateControllers)).toThrow(
      "route-registration-duplicate-endpoint",
    );
  });

  it("rejects missing route registrations against a contract graph", () => {
    const table = createRouteRegistrationTable(mockControllers);
    const partialTable = {
      ...table,
      entries: table.entries.slice(0, 1),
    };
    const graph = {
      version: "croco.contract-graph.v1" as const,
      controllers: [],
      routes: [
        {
          routeId: "SampleController.hello",
          operationId: "SampleController_hello",
          controllerName: "SampleController",
          methodName: "hello",
          httpMethod: "GET",
          path: "/api/hello",
          controllerPath: "/api",
          params: [],
          inputSchema: null,
          inputSchemas: { body: null, path: null, query: null, headers: null },
          outputSchema: null,
          domain: null,
          access: { guards: [], roles: [] },
        },
        {
          routeId: "SampleController.createUser",
          operationId: "SampleController_createUser",
          controllerName: "SampleController",
          methodName: "createUser",
          httpMethod: "POST",
          path: "/api/users",
          controllerPath: "/api",
          params: [],
          inputSchema: null,
          inputSchemas: { body: null, path: null, query: null, headers: null },
          outputSchema: null,
          domain: null,
          access: { guards: [], roles: [] },
        },
      ],
      diagnostics: [],
    };

    expect(() => assertRouteRegistrationTable(partialTable, graph)).toThrow(
      "route-registration-missing-route",
    );
  });

  it("writes routes.js and a route registration table artifact", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "croco-framework-routes-"));

    try {
      const moduleUrl = new URL("./fixtures/SampleController.ts", import.meta.url).href;
      const intentFixtureUrl = new URL("./fixtures/IntentMapModule.ts", import.meta.url).href;

      await compileRoutes({
        controllerPaths: [moduleUrl],
        sourcePaths: [moduleUrl, intentFixtureUrl],
        outputDir,
      });

      const code = await readFile(join(outputDir, ".croco", "build", "routes.js"), "utf-8");
      const table = JSON.parse(
        await readFile(
          join(outputDir, ".croco", "build", "route-registration-table.json"),
          "utf-8",
        ),
      );
      const intentMap = JSON.parse(
        await readFile(join(outputDir, ".croco", "build", "intent-map.json"), "utf-8"),
      );
      const frameworkManifest = JSON.parse(
        await readFile(join(outputDir, ".croco", "build", "framework-manifest.json"), "utf-8"),
      );

      expect(code).toContain("export function registerRoutes(app)");
      expect(code).toContain("routeRegistrationTable");
      expect(code).toContain("registerGeneratedRoute(app, route)");
      expect(table).toMatchObject({
        version: "croco.route-registration-table.v1",
        category: "http.controller",
        entries: [
          { id: "SampleController.hello", method: "GET", path: "/api/hello" },
          { id: "SampleController.createUser", method: "POST", path: "/api/users" },
        ],
      });
      expect(intentMap).toMatchObject({
        version: "croco.intent-map.v1",
        summary: { controllers: 1, routes: 2, providers: 3, eventHandlers: 1 },
        generatedArtifacts: expect.arrayContaining([
          expect.objectContaining({
            kind: "intent-map",
            path: ".croco/build/intent-map.json",
          }),
        ]),
        controllers: [
          expect.objectContaining({
            id: "SampleController",
            routeIds: ["SampleController.createUser", "SampleController.hello"],
          }),
        ],
        providers: expect.arrayContaining([
          expect.objectContaining({ id: "UserService", dependencies: ["UserRepository"] }),
        ]),
        eventHandlers: [
          expect.objectContaining({ id: "UserCreatedHandler", eventName: "user.created" }),
        ],
      });
      expect(frameworkManifest).toMatchObject({
        version: "croco.framework-manifest.v1",
        summary: {
          controllers: 1,
          routes: 2,
          providers: 3,
          eventHandlers: 1,
          domainEvents: 1,
        },
        generatedArtifacts: expect.arrayContaining([
          expect.objectContaining({
            kind: "framework-manifest",
            path: ".croco/build/framework-manifest.json",
            commitPolicy: expect.any(String),
          }),
        ]),
        entities: expect.arrayContaining([
          expect.objectContaining({ kind: "http.controller", id: "SampleController" }),
          expect.objectContaining({ kind: "di.provider", id: "UserService" }),
          expect.objectContaining({ kind: "event.handler", id: "UserCreatedHandler" }),
        ]),
      });
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("fails generation when controller metadata is missing a declared path parameter", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "croco-framework-routes-"));

    try {
      const moduleUrl = new URL("./fixtures/MissingPathParamController.ts", import.meta.url).href;

      await expect(compileRoutes({ controllerPaths: [moduleUrl], outputDir })).rejects.toThrow(
        "contract-route-missing-path-param",
      );
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("keeps reflect-metadata external in the bundle config", async () => {
    const config = await readFile(new URL("../../tsup.config.ts", import.meta.url), "utf-8");

    expect(config).toContain('external: ["reflect-metadata"]');
  });
});
