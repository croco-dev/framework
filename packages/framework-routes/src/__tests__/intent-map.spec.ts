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

  it("keeps same-named providers in different modules as distinct entities", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = mkdtempSync(join(tmpdir(), "croco-intent-duplicate-provider-"));

    try {
      const component = "function Component() { return () => {}; }\n";
      writeFileSync(join(root, "a.ts"), `${component}@Component() export class Service {}`);
      writeFileSync(
        join(root, "b.ts"),
        `${component}@Component() export class Service {\n  constructor(private readonly other: unknown) {}\n}`,
      );
      const intentMap = createProjectIntentMap({
        projectRoot: root,
        sourcePaths: ["a.ts", "b.ts"],
      });

      expect(intentMap.providers).toHaveLength(2);
      expect(new Set(intentMap.providers.map((provider) => provider.id)).size).toBe(2);
      expect(intentMap.providers.map((provider) => provider.id).sort()).toEqual([
        "a#Service",
        "b#Service",
      ]);
      expect(
        createProjectIntentMap({ projectRoot: root, sourcePaths: ["a.ts", "b.ts"] }).providers,
      ).toEqual(intentMap.providers);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves a constructor dependency to the imported same-named provider", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = mkdtempSync(join(tmpdir(), "croco-intent-provider-edge-"));

    try {
      const component = "function Component() { return () => {}; }\n";
      writeFileSync(join(root, "a.ts"), `${component}@Component() export class Repository {}`);
      writeFileSync(join(root, "b.ts"), `${component}@Component() export class Repository {}`);
      writeFileSync(
        join(root, "service.ts"),
        `${component}import { Repository } from "./a";\n@Component() export class Service {\n  constructor(private readonly repository: Repository) {}\n}`,
      );
      const intentMap = createProjectIntentMap({
        projectRoot: root,
        sourcePaths: ["a.ts", "b.ts", "service.ts"],
      });
      const service = intentMap.providers.find((provider) => provider.name === "Service");

      expect(service?.dependencies).toEqual(["a#Repository"]);
      expect(intentMap.relationships).toContainEqual(
        expect.objectContaining({
          kind: "component.depends-on",
          from: { kind: "provider", id: "Service" },
          to: { kind: "provider", id: "a#Repository" },
        }),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves an aliased constructor dependency to the imported provider", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = mkdtempSync(join(tmpdir(), "croco-intent-provider-alias-"));

    try {
      const component = "function Component() { return () => {}; }\n";
      writeFileSync(join(root, "a.ts"), `${component}@Component() export class Repository {}`);
      writeFileSync(join(root, "b.ts"), `${component}@Component() export class Repository {}`);
      writeFileSync(
        join(root, "service.ts"),
        `${component}import { Repository as Repo } from "./a";\n@Component() export class Service {\n  constructor(private readonly repository: Repo) {}\n}`,
      );
      const intentMap = createProjectIntentMap({
        projectRoot: root,
        sourcePaths: ["a.ts", "b.ts", "service.ts"],
      });
      const service = intentMap.providers.find((provider) => provider.name === "Service");

      expect(service?.dependencies).toEqual(["a#Repository"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves an ambiguous dependency name when no import disambiguates it", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = mkdtempSync(join(tmpdir(), "croco-intent-provider-ambiguous-"));

    try {
      const component = "function Component() { return () => {}; }\n";
      writeFileSync(join(root, "a.ts"), `${component}@Component() export class Service {}`);
      writeFileSync(join(root, "b.ts"), `${component}@Component() export class Service {}`);
      writeFileSync(
        join(root, "consumer.ts"),
        `${component}@Component() export class Consumer {\n  constructor(private readonly service: Service) {}\n}`,
      );
      const intentMap = createProjectIntentMap({
        projectRoot: root,
        sourcePaths: ["a.ts", "b.ts", "consumer.ts"],
      });
      const consumer = intentMap.providers.find((provider) => provider.name === "Consumer");

      expect(consumer?.dependencies).toEqual(["Service"]);
      expect(
        intentMap.relationships.filter(
          (relationship) => relationship.kind === "component.depends-on",
        ),
      ).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves a default import to the target module's default provider", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = mkdtempSync(join(tmpdir(), "croco-intent-provider-default-"));

    try {
      const component = "function Component() { return () => {}; }\n";
      writeFileSync(
        join(root, "a.ts"),
        `${component}@Component() export default class Repository {}`,
      );
      writeFileSync(join(root, "b.ts"), `${component}@Component() export class Repository {}`);
      writeFileSync(
        join(root, "service.ts"),
        `${component}import Repo from "./a";\n@Component() export class Service {\n  constructor(private readonly repository: Repo) {}\n}`,
      );
      const intentMap = createProjectIntentMap({
        projectRoot: root,
        sourcePaths: ["a.ts", "b.ts", "service.ts"],
      });
      const service = intentMap.providers.find((provider) => provider.name === "Service");

      expect(service?.dependencies).toEqual(["a#Repository"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("falls back to name resolution when an import points outside the scanned sources", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = mkdtempSync(join(tmpdir(), "croco-intent-provider-stale-"));

    try {
      const component = "function Component() { return () => {}; }\n";
      writeFileSync(join(root, "a.ts"), `${component}@Component() export class Repository {}`);
      writeFileSync(
        join(root, "service.ts"),
        `${component}import { Repository } from "./missing";\n@Component() export class Service {\n  constructor(private readonly repository: Repository) {}\n}`,
      );
      const intentMap = createProjectIntentMap({
        projectRoot: root,
        sourcePaths: ["a.ts", "service.ts"],
      });
      const service = intentMap.providers.find((provider) => provider.name === "Service");

      expect(service?.dependencies).toEqual(["Repository"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves a dependency with no matching provider instead of dropping it", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = mkdtempSync(join(tmpdir(), "croco-intent-provider-unknown-"));

    try {
      const component = "function Component() { return () => {}; }\n";
      writeFileSync(
        join(root, "service.ts"),
        `${component}@Component() export class Service {\n  constructor(private readonly repository: MissingRepository) {}\n}`,
      );
      const intentMap = createProjectIntentMap({
        projectRoot: root,
        sourcePaths: ["service.ts"],
      });
      const service = intentMap.providers.find((provider) => provider.name === "Service");

      expect(service?.dependencies).toEqual(["MissingRepository"]);
      expect(
        intentMap.relationships.filter(
          (relationship) => relationship.kind === "component.depends-on",
        ),
      ).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves imports using JavaScript extensions and directory index files", async () => {
    const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = mkdtempSync(join(tmpdir(), "croco-intent-provider-ext-"));

    try {
      const component = "function Component() { return () => {}; }\n";
      writeFileSync(join(root, "a.ts"), `${component}@Component() export class Repository {}`);
      writeFileSync(join(root, "b.ts"), `${component}@Component() export class Repository {}`);
      mkdirSync(join(root, "repos"), { recursive: true });
      writeFileSync(
        join(root, "repos", "index.mjs"),
        `${component}@Component() export class MjsRepository {}`,
      );
      writeFileSync(
        join(root, "service.ts"),
        `${component}import { Repository } from "./a.js";\nimport { MjsRepository } from "./repos";\n@Component() export class Service {\n  constructor(private readonly a: Repository, private readonly b: MjsRepository) {}\n}`,
      );
      const intentMap = createProjectIntentMap({
        projectRoot: root,
        sourcePaths: ["a.ts", "b.ts", "repos/index.mjs", "service.ts"],
      });
      const service = intentMap.providers.find((provider) => provider.name === "Service");

      expect(service?.dependencies).toEqual(["MjsRepository", "a#Repository"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves the raw name when an import points at a non-provider file", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = mkdtempSync(join(tmpdir(), "croco-intent-provider-nonprovider-"));

    try {
      const component = "function Component() { return () => {}; }\n";
      writeFileSync(join(root, "a.ts"), `export class Repository {}`);
      writeFileSync(join(root, "b.ts"), `${component}@Component() export class Repository {}`);
      writeFileSync(
        join(root, "service.ts"),
        `${component}import { Repository } from "./a";\n@Component() export class Service {\n  constructor(private readonly repository: Repository) {}\n}`,
      );
      const intentMap = createProjectIntentMap({
        projectRoot: root,
        sourcePaths: ["a.ts", "b.ts", "service.ts"],
      });
      const service = intentMap.providers.find((provider) => provider.name === "Service");

      expect(service?.dependencies).toEqual(["Repository"]);
      expect(
        intentMap.relationships.filter(
          (relationship) => relationship.kind === "component.depends-on",
        ),
      ).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps providers with the same stem in different extensions distinct", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = mkdtempSync(join(tmpdir(), "croco-intent-provider-ext-collision-"));

    try {
      const component = "function Component() { return () => {}; }\n";
      writeFileSync(join(root, "a.ts"), `${component}@Component() export class Service {}`);
      writeFileSync(join(root, "a.mts"), `${component}@Component() export class Service {}`);
      const intentMap = createProjectIntentMap({
        projectRoot: root,
        sourcePaths: ["a.ts", "a.mts"],
      });

      expect(intentMap.providers).toHaveLength(2);
      expect(new Set(intentMap.providers.map((provider) => provider.id)).size).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
