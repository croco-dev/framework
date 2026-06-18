import "reflect-metadata";
import { fileURLToPath } from "node:url";
import { buildContractGraph } from "@croco/protocols-core";
import { describe, expect, it } from "vitest";
import { createProjectIntentMap } from "../intent-map";
import { SampleController } from "./fixtures/SampleController";

describe("project intent map", () => {
  const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
  const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
  const sampleControllerPath = new URL("./fixtures/SampleController.ts", import.meta.url).href;
  const intentFixturePath = new URL("./fixtures/IntentMapModule.ts", import.meta.url).href;

  it("describes controllers, providers, event handlers, public symbols, and generated artifacts", () => {
    const graph = buildContractGraph([SampleController]);
    const intentMap = createProjectIntentMap({
      projectRoot: repoRoot,
      sourcePaths: [sampleControllerPath, intentFixturePath],
      contractGraph: graph,
    });

    expect(intentMap.version).toBe("croco.intent-map.v1");
    expect(intentMap.summary).toMatchObject({
      controllers: 1,
      routes: 2,
      providers: 3,
      eventHandlers: 1,
    });
    expect(intentMap.generatedArtifacts).toContainEqual(
      expect.objectContaining({
        kind: "intent-map",
        path: ".croco/build/intent-map.json",
        gitIgnored: true,
        gitIgnoreRule: "**/.croco/build",
      }),
    );

    expect(intentMap.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "packages/framework-routes/src/__tests__/fixtures/SampleController.ts",
          roles: ["http.controller"],
        }),
        expect.objectContaining({
          path: "packages/framework-routes/src/__tests__/fixtures/IntentMapModule.ts",
          roles: ["di.provider", "domain.event", "event.handler"],
          publicSymbols: expect.arrayContaining([
            expect.objectContaining({ name: "PublicUserDto", kind: "type" }),
          ]),
        }),
      ]),
    );

    expect(intentMap.controllers).toEqual([
      expect.objectContaining({
        id: "SampleController",
        path: "/api",
        routeIds: ["SampleController.createUser", "SampleController.hello"],
        source: expect.objectContaining({
          path: "packages/framework-routes/src/__tests__/fixtures/SampleController.ts",
          line: 5,
        }),
      }),
    ]);
    expect(intentMap.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "SampleController.hello",
          method: "GET",
          path: "/api/hello",
          controllerId: "SampleController",
        }),
      ]),
    );
    expect(intentMap.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "UserRepository",
          scope: "request",
          dependencies: [],
        }),
        expect.objectContaining({
          id: "UserService",
          scope: "singleton",
          dependencies: ["UserRepository"],
        }),
      ]),
    );
    expect(intentMap.eventHandlers).toEqual([
      expect.objectContaining({
        id: "UserCreatedHandler",
        eventName: "user.created",
        eventClassName: "UserCreatedEvent",
      }),
    ]);
    expect(intentMap.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "controller.exposes-route",
          from: { kind: "controller", id: "SampleController" },
          to: { kind: "route", id: "SampleController.hello" },
        }),
        expect.objectContaining({
          kind: "component.depends-on",
          from: { kind: "provider", id: "UserService" },
          to: { kind: "provider", id: "UserRepository" },
        }),
        expect.objectContaining({
          kind: "event-handler.handles-event",
          from: { kind: "event-handler", id: "UserCreatedHandler" },
          to: { kind: "event", id: "user.created" },
        }),
      ]),
    );
    expect(intentMap.sensitiveDataPolicy.excluded).toContain("environment variable values");
  });

  it("respects parent gitignore rules for package-local generated artifacts", () => {
    const intentMap = createProjectIntentMap({
      projectRoot: packageRoot,
      sourcePaths: [intentFixturePath],
    });

    expect(intentMap.generatedArtifacts).toContainEqual(
      expect.objectContaining({
        kind: "intent-map",
        gitIgnored: true,
        gitIgnoreRule: "**/.croco/build",
      }),
    );
  });

  it("fails when an explicit source path does not exist", () => {
    expect(() =>
      createProjectIntentMap({
        projectRoot: repoRoot,
        sourcePaths: ["packages/framework-routes/src/__tests__/fixtures/MissingIntent.ts"],
      }),
    ).toThrow("Intent map source path does not exist");
  });
});
