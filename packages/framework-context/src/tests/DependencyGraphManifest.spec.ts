import "reflect-metadata";
import { Container as TypeDIContainer } from "typedi";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Component, Container, Inject, MetadataStorage, Token } from "../index";

describe("Dependency graph manifest", () => {
  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
  });

  it("fails missing token providers before startup", () => {
    const configToken = new Token<string>("database.url");

    class UserService {
      constructor(readonly config: unknown) {}
    }

    Reflect.defineMetadata("design:paramtypes", [Object], UserService);
    injectConstructorToken(UserService, 0, configToken);
    Component()(UserService);

    const manifest = Container.createDependencyGraphManifest({ roots: [UserService] });

    expect(manifest).toMatchObject({
      version: "croco.di-graph.manifest.v1",
      status: "failed",
      roots: ["UserService"],
      diagnostics: [
        {
          code: "CROCO_DI_001",
          legacyCode: "framework-context/di-missing-provider",
          severity: "error",
          token: "Token<database.url>",
          status: "missing",
          path: ["UserService", "Token<database.url>"],
        },
      ],
    });
    expect(Container.has(UserService)).toBe(false);
  });

  it("preserves legacy diagnostic codes when validation throws", () => {
    const configToken = new Token<string>("database.url");

    class UserService {
      constructor(readonly config: unknown) {}
    }

    Reflect.defineMetadata("design:paramtypes", [Object], UserService);
    injectConstructorToken(UserService, 0, configToken);
    Component()(UserService);

    try {
      Container.validate({ force: true });
    } catch (error) {
      expect(error).toMatchObject({
        code: "CROCO_DI_001",
        extensions: {
          legacyCode: "framework-context/di-missing-provider",
          token: "Token<database.url>",
        },
      });
      return;
    }

    throw new Error("Expected Container.validate to throw");
  });

  it("emits source-location diagnostics for circular component graphs", () => {
    class ServiceA {
      constructor(readonly dependency: unknown) {}
    }

    class ServiceB {
      constructor(readonly dependency: unknown) {}
    }

    Reflect.defineMetadata("design:paramtypes", [ServiceB], ServiceA);
    Reflect.defineMetadata("design:paramtypes", [ServiceA], ServiceB);
    Component({ scope: "transient" })(ServiceA);
    Component({ scope: "transient" })(ServiceB);

    const manifest = Container.createDependencyGraphManifest({ roots: [ServiceA] });
    const diagnostic = manifest.diagnostics.find((entry) => entry.code === "CROCO_DI_002");

    expect(manifest.status).toBe("failed");
    expect(diagnostic).toMatchObject({
      legacyCode: "framework-context/di-circular-dependency",
      token: "ServiceA",
      status: "circular",
      path: ["ServiceA", "ServiceB", "ServiceA"],
    });
    expect(diagnostic?.sourceLocation?.file).toContain("DependencyGraphManifest.spec.ts");
    expect(diagnostic?.sourceLocation?.line).toBeGreaterThan(0);
  });

  it("fails singleton to request-scope dependency captures", () => {
    class RequestRepository {}

    class UserService {
      constructor(readonly repository: RequestRepository) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], RequestRepository);
    Reflect.defineMetadata("design:paramtypes", [RequestRepository], UserService);
    Component({ scope: "request" })(RequestRepository);
    Component()(UserService);

    const manifest = Container.createDependencyGraphManifest({ roots: [UserService] });

    expect(manifest.status).toBe("failed");
    expect(manifest.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "CROCO_DI_003",
        legacyCode: "framework-context/di-scope-mismatch",
        token: "RequestRepository",
        status: "scope-mismatch",
        path: ["UserService", "RequestRepository"],
      }),
    );
  });

  it("marks TypeDI fallback providers as explicit unknown capability", () => {
    class Repository {}

    class UserService {
      constructor(readonly repository: Repository) {}
    }

    Reflect.defineMetadata("design:paramtypes", [Repository], UserService);
    Component()(UserService);

    const manifest = Container.createDependencyGraphManifest({ roots: [UserService] });

    expect(manifest.status).toBe("failed");
    expect(manifest.providers).toContainEqual(
      expect.objectContaining({
        token: "Repository",
        provider: "typedi",
      }),
    );
    expect(manifest.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "CROCO_DI_004",
        legacyCode: "framework-context/di-unknown-provider",
        token: "Repository",
      }),
    );
  });

  it("fails explicitly when a TypeDI injection handler cannot be inspected", () => {
    class Repository {}

    class UserService {
      constructor(readonly repository: Repository) {}
    }

    Reflect.defineMetadata("design:paramtypes", [Repository], UserService);
    TypeDIContainer.registerHandler({
      object: UserService,
      index: 0,
      value: () => {
        throw new Error("handler runtime failure");
      },
    });
    Component()(Repository);
    Component()(UserService);

    const manifest = Container.createDependencyGraphManifest({ roots: [UserService] });

    expect(manifest.status).toBe("failed");
    expect(manifest.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "CROCO_DI_005",
        legacyCode: "framework-context/di-injection-handler-uninspectable",
        token: "UserService",
      }),
    );
    expect(() => Container.get(UserService)).toThrow("handler runtime failure");
  });

  it("emits deterministic root, provider, dependency, and diagnostic ordering", () => {
    const firstConfigToken = new Token<string>("config.url");
    const secondConfigToken = new Token<string>("config.url");
    const FirstSharedService = class SharedService {};
    const SecondSharedService = class SharedService {};

    class ZRoot {
      constructor(
        readonly shared: InstanceType<typeof SecondSharedService>,
        readonly config: unknown,
      ) {}
    }

    class ARoot {
      constructor(
        readonly shared: InstanceType<typeof FirstSharedService>,
        readonly config: unknown,
      ) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], FirstSharedService);
    Reflect.defineMetadata("design:paramtypes", [], SecondSharedService);
    Reflect.defineMetadata("design:paramtypes", [FirstSharedService, Object], ARoot);
    Reflect.defineMetadata("design:paramtypes", [SecondSharedService, Object], ZRoot);
    injectConstructorToken(ARoot, 1, firstConfigToken);
    injectConstructorToken(ZRoot, 1, secondConfigToken);
    Component({ scope: "transient" })(FirstSharedService);
    Component({ scope: "transient" })(SecondSharedService);
    Component({ scope: "transient" })(ZRoot);
    Component({ scope: "transient" })(ARoot);

    const firstManifest = Container.createDependencyGraphManifest({ roots: [ZRoot, ARoot] });
    const secondManifest = Container.createDependencyGraphManifest({ roots: [ARoot, ZRoot] });

    expect(firstManifest.rootIds).toEqual(secondManifest.rootIds);
    expect(firstManifest.providers.map((provider) => provider.tokenId)).toEqual(
      secondManifest.providers.map((provider) => provider.tokenId),
    );
    expect(firstManifest.providers.map((provider) => provider.dependencyIds)).toEqual(
      secondManifest.providers.map((provider) => provider.dependencyIds),
    );
    expect(firstManifest.diagnostics.map((diagnostic) => diagnostic.tokenId)).toEqual(
      secondManifest.diagnostics.map((diagnostic) => diagnostic.tokenId),
    );
    expect(firstManifest.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CROCO_DI_001",
      "CROCO_DI_001",
    ]);
    expect(firstManifest.providers).toHaveLength(6);
    expect(new Set(firstManifest.providers.map((provider) => provider.tokenId)).size).toBe(
      firstManifest.providers.length,
    );
  });

  it("keeps same-label providers separate in graph aggregation", () => {
    const FirstSharedService = class SharedService {};
    const SecondSharedService = class SharedService {};

    class FirstRoot {
      constructor(readonly service: InstanceType<typeof FirstSharedService>) {}
    }

    class SecondRoot {
      constructor(readonly service: InstanceType<typeof SecondSharedService>) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], FirstSharedService);
    Reflect.defineMetadata("design:paramtypes", [], SecondSharedService);
    Reflect.defineMetadata("design:paramtypes", [FirstSharedService], FirstRoot);
    Reflect.defineMetadata("design:paramtypes", [SecondSharedService], SecondRoot);
    Component({ scope: "transient" })(FirstSharedService);
    Component({ scope: "transient" })(SecondSharedService);
    Component({ scope: "transient" })(FirstRoot);
    Component({ scope: "transient" })(SecondRoot);

    const manifest = Container.createDependencyGraphManifest({ roots: [FirstRoot, SecondRoot] });
    const sharedProviders = manifest.providers.filter(
      (provider) => provider.token === "SharedService",
    );

    expect(sharedProviders).toHaveLength(2);
    expect(new Set(sharedProviders.map((provider) => provider.tokenId)).size).toBe(2);
    expect(
      manifest.providers.find((provider) => provider.token === "FirstRoot")?.dependencyIds,
    ).toEqual([sharedProviders[0]?.tokenId]);
    expect(
      manifest.providers.find((provider) => provider.token === "SecondRoot")?.dependencyIds,
    ).toEqual([sharedProviders[1]?.tokenId]);
  });

  it("captures best-effort source locations from common stack trace formats", () => {
    const stackCases = [
      {
        name: "esm",
        frame: "    at file:///workspace/app/src/EsmService.ts:42:5",
        expected: { file: "/workspace/app/src/EsmService.ts", line: 42, column: 5 },
      },
      {
        name: "windows",
        frame: "    at Object.<anonymous> (C:\\workspace\\app\\src\\WindowsService.ts:12:34)",
        expected: { file: "C:/workspace/app/src/WindowsService.ts", line: 12, column: 34 },
      },
      {
        name: "bundled",
        frame:
          "    at Module../src/BundledService.ts (webpack://croco-app/./src/BundledService.ts:8:13)",
        expected: { file: "webpack://croco-app/./src/BundledService.ts", line: 8, column: 13 },
      },
      {
        name: "minified-like",
        frame: "    at /workspace/dist/app.min.js:1:982",
        expected: { file: "/workspace/dist/app.min.js", line: 1, column: 982 },
      },
    ] as const;

    for (const stackCase of stackCases) {
      Container.reset();
      MetadataStorage.clear();

      withSourceStack([stackCase.frame], () => {
        class FixtureService {}

        Reflect.defineMetadata("design:paramtypes", [], FixtureService);
        Component()(FixtureService);

        const manifest = Container.createDependencyGraphManifest({ roots: [FixtureService] });

        expect(
          getProvider(manifest, "FixtureService")?.sourceLocation,
          stackCase.name,
        ).toMatchObject(stackCase.expected);
      });
    }
  });

  it("skips published and bundled framework internals before app source frames", () => {
    withSourceStack(
      [
        "    at Container.register (/app/node_modules/@croco/framework-context/dist/index.js:1:200)",
        "    at Component (webpack://@croco/framework-context/./dist/index.mjs:1:400)",
        "    at file:///workspace/app/src/AppService.ts:21:7",
      ],
      () => {
        class AppService {}

        Reflect.defineMetadata("design:paramtypes", [], AppService);
        Component()(AppService);

        const manifest = Container.createDependencyGraphManifest({ roots: [AppService] });

        expect(getProvider(manifest, "AppService")?.sourceLocation).toMatchObject({
          file: "/workspace/app/src/AppService.ts",
          line: 21,
          column: 7,
        });
      },
    );
  });

  it("keeps app src/libs frames when they are normalized from a consumer cwd", () => {
    withCwd("/app", () => {
      withSourceStack(["    at file:///app/src/libs/AppService.ts:21:7"], () => {
        class AppService {}

        Reflect.defineMetadata("design:paramtypes", [], AppService);
        Component()(AppService);

        const manifest = Container.createDependencyGraphManifest({ roots: [AppService] });

        expect(getProvider(manifest, "AppService")?.sourceLocation).toMatchObject({
          file: "src/libs/AppService.ts",
          line: 21,
          column: 7,
        });
      });
    });
  });

  it("skips package-cwd framework src/libs frames before app source frames", () => {
    withCwd("/repo/packages/framework-context", () => {
      withSourceStack(
        [
          "    at Container.register (src/libs/Container.ts:1:200)",
          "    at file:///repo/apps/api/src/AppService.ts:21:7",
        ],
        () => {
          class AppService {}

          Reflect.defineMetadata("design:paramtypes", [], AppService);
          Component()(AppService);

          const manifest = Container.createDependencyGraphManifest({ roots: [AppService] });

          expect(getProvider(manifest, "AppService")?.sourceLocation).toMatchObject({
            file: "/repo/apps/api/src/AppService.ts",
            line: 21,
            column: 7,
          });
        },
      );
    });
  });

  it("skips repo-root framework source and dist frames before app source frames", () => {
    withCwd("/repo", () => {
      withSourceStack(
        [
          "    at Container.captureSourceLocation (/repo/packages/framework-context/src/libs/Container.ts:1:200)",
          "    at Component (/repo/packages/framework-context/dist/index.js:1:400)",
          "    at file:///repo/apps/api/src/AppService.ts:21:7",
        ],
        () => {
          class AppService {}

          Reflect.defineMetadata("design:paramtypes", [], AppService);
          Component()(AppService);

          const manifest = Container.createDependencyGraphManifest({ roots: [AppService] });

          expect(getProvider(manifest, "AppService")?.sourceLocation).toMatchObject({
            file: "apps/api/src/AppService.ts",
            line: 21,
            column: 7,
          });
        },
      );
    });
  });

  it("keeps token ids stable when source locations are missing or degraded", () => {
    class DegradedService {}

    withSourceStack(["    at native"], () => {
      Reflect.defineMetadata("design:paramtypes", [], DegradedService);
      Component()(DegradedService);
    });

    const degradedManifest = Container.createDependencyGraphManifest({ roots: [DegradedService] });
    const degradedProvider = getProvider(degradedManifest, "DegradedService");

    expect(degradedProvider?.tokenId).toBe("constructor:DegradedService");
    expect(degradedProvider).not.toHaveProperty("sourceLocation");

    Container.reset();
    MetadataStorage.clear();

    withSourceStack(["    at file:///workspace/app/src/DegradedService.ts:10:2"], () => {
      Reflect.defineMetadata("design:paramtypes", [], DegradedService);
      Component()(DegradedService);
    });

    const richManifest = Container.createDependencyGraphManifest({ roots: [DegradedService] });
    const richProvider = getProvider(richManifest, "DegradedService");

    expect(richProvider?.tokenId).toBe(degradedProvider?.tokenId);
    expect(richProvider?.sourceLocation).toMatchObject({
      file: "/workspace/app/src/DegradedService.ts",
      line: 10,
      column: 2,
    });
  });

  it("keeps same-label token ids stable after partial manifest creation", () => {
    const firstGraph = registerSameLabelGraph();

    Container.createDependencyGraphManifest({ roots: [firstGraph.SecondRoot] });
    const fullAfterPartial = Container.createDependencyGraphManifest({
      roots: [firstGraph.SecondRoot, firstGraph.FirstRoot],
    });

    Container.reset();
    MetadataStorage.clear();

    const secondGraph = registerSameLabelGraph();
    const fullFresh = Container.createDependencyGraphManifest({
      roots: [secondGraph.FirstRoot, secondGraph.SecondRoot],
    });

    expect(toManifestIdentity(fullAfterPartial)).toEqual(toManifestIdentity(fullFresh));
  });

  it("lets generated code override source metadata without changing token ids", () => {
    class GeneratedService {}

    Reflect.defineMetadata("design:paramtypes", [], GeneratedService);
    Container.setComponentSourceLocation(GeneratedService, {
      file: "dist/generated-service.js",
      line: 1,
      column: 120,
    });
    Component()(GeneratedService);

    const generatedManifest = Container.createDependencyGraphManifest({
      roots: [GeneratedService],
    });
    const generatedProvider = getProvider(generatedManifest, "GeneratedService");

    expect(generatedProvider?.tokenId).toBe("constructor:GeneratedService");
    expect(generatedProvider?.sourceLocation).toMatchObject({
      file: "dist/generated-service.js",
      line: 1,
      column: 120,
    });

    Container.setComponentSourceLocation(GeneratedService, {
      file: "src/services/GeneratedService.ts",
      line: 18,
      column: 3,
    });
    Component()(GeneratedService);

    const sourceManifest = Container.createDependencyGraphManifest({ roots: [GeneratedService] });
    const sourceProvider = getProvider(sourceManifest, "GeneratedService");

    expect(sourceProvider?.tokenId).toBe(generatedProvider?.tokenId);
    expect(sourceProvider?.sourceLocation).toMatchObject({
      file: "src/services/GeneratedService.ts",
      line: 18,
      column: 3,
    });
  });

  it("clears explicit source metadata through undefined, remove, and reset", () => {
    class ClearableService {}

    Reflect.defineMetadata("design:paramtypes", [], ClearableService);
    Container.setComponentSourceLocation(ClearableService, {
      file: "dist/clearable-service.js",
      line: 1,
      column: 10,
    });
    Component()(ClearableService);

    expect(
      getProvider(
        Container.createDependencyGraphManifest({ roots: [ClearableService] }),
        "ClearableService",
      )?.sourceLocation,
    ).toMatchObject({ file: "dist/clearable-service.js" });

    Container.setComponentSourceLocation(ClearableService, undefined);

    expect(
      getProvider(
        Container.createDependencyGraphManifest({ roots: [ClearableService] }),
        "ClearableService",
      ),
    ).not.toHaveProperty("sourceLocation");

    Container.setComponentSourceLocation(ClearableService, {
      file: "dist/clearable-service.js",
      line: 1,
      column: 10,
    });
    Container.remove(ClearableService);
    withSourceStack(["    at native"], () => Component()(ClearableService));

    expect(
      getProvider(
        Container.createDependencyGraphManifest({ roots: [ClearableService] }),
        "ClearableService",
      ),
    ).not.toHaveProperty("sourceLocation");

    Container.setComponentSourceLocation(ClearableService, {
      file: "dist/clearable-service.js",
      line: 1,
      column: 10,
    });
    Container.reset();
    MetadataStorage.clear();
    withSourceStack(["    at native"], () => Component()(ClearableService));

    expect(
      getProvider(
        Container.createDependencyGraphManifest({ roots: [ClearableService] }),
        "ClearableService",
      ),
    ).not.toHaveProperty("sourceLocation");
  });
});

function injectConstructorToken(target: object, parameterIndex: number, token: unknown): void {
  (Inject(token as never) as ParameterDecorator)(target, undefined, parameterIndex);
}

function getProvider(
  manifest: ReturnType<typeof Container.createDependencyGraphManifest>,
  token: string,
) {
  return manifest.providers.find((provider) => provider.token === token);
}

function withSourceStack(frames: readonly string[], callback: () => void): void {
  const OriginalError = globalThis.Error;
  class StackError extends OriginalError {
    constructor(message?: string) {
      super(message);
      this.stack = [
        "Error",
        "    at Container.captureSourceLocation (/workspace/packages/framework-context/src/libs/Container.ts:430:20)",
        ...frames,
      ].join("\n");
    }
  }

  try {
    vi.stubGlobal("Error", StackError);
    callback();
  } finally {
    vi.stubGlobal("Error", OriginalError);
  }
}

function withCwd(cwd: string, callback: () => void): void {
  const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(cwd);

  try {
    callback();
  } finally {
    cwdSpy.mockRestore();
  }
}

function registerSameLabelGraph() {
  const FirstSharedService = class SharedService {};
  const SecondSharedService = class SharedService {};

  class FirstRoot {
    constructor(readonly service: InstanceType<typeof FirstSharedService>) {}
  }

  class SecondRoot {
    constructor(readonly service: InstanceType<typeof SecondSharedService>) {}
  }

  Reflect.defineMetadata("design:paramtypes", [], FirstSharedService);
  Reflect.defineMetadata("design:paramtypes", [], SecondSharedService);
  Reflect.defineMetadata("design:paramtypes", [FirstSharedService], FirstRoot);
  Reflect.defineMetadata("design:paramtypes", [SecondSharedService], SecondRoot);
  Component({ scope: "transient" })(FirstSharedService);
  Component({ scope: "transient" })(SecondSharedService);
  Component({ scope: "transient" })(FirstRoot);
  Component({ scope: "transient" })(SecondRoot);

  return { FirstRoot, SecondRoot };
}

function toManifestIdentity(manifest: ReturnType<typeof Container.createDependencyGraphManifest>) {
  return {
    rootIds: manifest.rootIds,
    providers: manifest.providers.map((provider) => ({
      token: provider.token,
      tokenId: provider.tokenId,
      dependencyIds: provider.dependencyIds,
    })),
    diagnostics: manifest.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      tokenId: diagnostic.tokenId,
      pathIds: diagnostic.pathIds,
    })),
  };
}
