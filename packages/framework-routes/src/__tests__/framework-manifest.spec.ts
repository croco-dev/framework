import "reflect-metadata";
import { fileURLToPath } from "node:url";
import { buildContractGraph } from "@croco/protocols-core";
import { describe, expect, it } from "vitest";
import { createFrameworkManifest, FrameworkManifestDiagnosticError } from "../framework-manifest";
import { SampleController } from "./fixtures/SampleController";

describe("framework manifest", () => {
  const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
  const sampleControllerPath = new URL("./fixtures/SampleController.ts", import.meta.url).href;
  const intentFixturePath = new URL("./fixtures/IntentMapModule.ts", import.meta.url).href;

  it("exposes a typed framework manifest for controllers, providers, and event handlers", () => {
    const manifest = createFrameworkManifest({
      projectRoot: repoRoot,
      sourcePaths: [sampleControllerPath, intentFixturePath],
      contractGraph: buildContractGraph([SampleController]),
      requiredEntityKinds: ["http.controller", "di.provider", "event.handler"],
    });

    expect(manifest.version).toBe("croco.framework-manifest.v1");
    expect(manifest.schema.entityVocabulary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "http.controller" }),
        expect.objectContaining({ kind: "di.provider" }),
        expect.objectContaining({ kind: "event.handler" }),
      ]),
    );
    expect(manifest.summary).toMatchObject({
      sourceFiles: 2,
      controllers: 1,
      routes: 2,
      providers: 3,
      eventHandlers: 1,
      domainEvents: 1,
    });
    expect(manifest.generatedArtifacts).toContainEqual(
      expect.objectContaining({
        kind: "framework-manifest",
        path: ".croco/build/framework-manifest.json",
        gitIgnored: true,
        commitPolicy: "gitignored-generated",
        gitIgnoreRule: "**/.croco/build",
      }),
    );
    expect(manifest.sourceFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "packages/framework-routes/src/__tests__/fixtures/IntentMapModule.ts",
          roles: ["di.provider", "domain.event", "event.handler"],
          exports: expect.arrayContaining([
            expect.objectContaining({
              name: "UserService",
              source: expect.objectContaining({
                path: "packages/framework-routes/src/__tests__/fixtures/IntentMapModule.ts",
              }),
            }),
          ]),
        }),
      ]),
    );
    expect(manifest.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "http.controller",
          id: "SampleController",
          path: "/api",
          routeIds: ["SampleController.createUser", "SampleController.hello"],
          exportSymbol: expect.objectContaining({ name: "SampleController" }),
        }),
        expect.objectContaining({
          kind: "di.provider",
          id: "UserService",
          scope: "singleton",
          dependencies: ["UserRepository"],
          exportSymbol: expect.objectContaining({ name: "UserService" }),
        }),
        expect.objectContaining({
          kind: "event.handler",
          id: "UserCreatedHandler",
          eventName: "user.created",
          eventClassName: "UserCreatedEvent",
        }),
        expect.objectContaining({
          kind: "domain.event",
          id: "user.created",
          name: "UserCreatedEvent",
        }),
      ]),
    );
    expect(manifest.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "event-handler.handles-event",
          from: { kind: "event.handler", id: "UserCreatedHandler" },
          to: { kind: "domain.event", id: "user.created" },
        }),
      ]),
    );
  });

  it("reports stable diagnostics when a required entity kind is missing", () => {
    expect(() =>
      createFrameworkManifest({
        projectRoot: repoRoot,
        sourcePaths: [sampleControllerPath],
        contractGraph: buildContractGraph([SampleController]),
        requiredEntityKinds: ["di.provider"],
      }),
    ).toThrow(FrameworkManifestDiagnosticError);

    try {
      createFrameworkManifest({
        projectRoot: repoRoot,
        sourcePaths: [sampleControllerPath],
        contractGraph: buildContractGraph([SampleController]),
        requiredEntityKinds: ["di.provider"],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(FrameworkManifestDiagnosticError);
      expect((error as FrameworkManifestDiagnosticError).diagnostics).toEqual([
        {
          code: "framework-manifest-required-entity-missing",
          severity: "error",
          entityKind: "di.provider",
          message:
            "Framework manifest requires at least one di.provider entity, but none were discovered.",
        },
      ]);
    }
  });

  it("wraps missing source paths in framework manifest diagnostics", () => {
    expect(() =>
      createFrameworkManifest({
        projectRoot: repoRoot,
        sourcePaths: ["packages/framework-routes/src/__tests__/fixtures/MissingManifest.ts"],
      }),
    ).toThrow("framework-manifest-source-path-not-found");
  });
});
