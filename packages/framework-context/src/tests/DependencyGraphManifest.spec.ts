import "reflect-metadata";
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

  it("captures Windows source locations from stack traces", () => {
    const OriginalError = globalThis.Error;
    class WindowsStackError extends OriginalError {
      constructor(message?: string) {
        super(message);
        this.stack = [
          "Error",
          "    at Container.captureSourceLocation (/workspace/packages/framework-context/src/libs/Container.ts:430:20)",
          "    at Object.<anonymous> (C:\\workspace\\app\\src\\WindowsService.ts:12:34)",
        ].join("\n");
      }
    }

    try {
      vi.stubGlobal("Error", WindowsStackError);

      class WindowsService {}

      Reflect.defineMetadata("design:paramtypes", [], WindowsService);
      Component()(WindowsService);

      const manifest = Container.createDependencyGraphManifest({ roots: [WindowsService] });

      expect(manifest.providers[0]?.sourceLocation).toMatchObject({
        file: "C:/workspace/app/src/WindowsService.ts",
        line: 12,
        column: 34,
      });
    } finally {
      vi.stubGlobal("Error", OriginalError);
    }
  });
});

function injectConstructorToken(target: object, parameterIndex: number, token: unknown): void {
  (Inject(token as never) as ParameterDecorator)(target, undefined, parameterIndex);
}
