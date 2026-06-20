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
      constructor(@Inject(configToken) readonly config: unknown) {}
    }

    Reflect.defineMetadata("design:paramtypes", [Object], UserService);
    Component()(UserService);

    const manifest = Container.createDependencyGraphManifest({ roots: [UserService] });

    expect(manifest).toMatchObject({
      version: "croco.di-graph.manifest.v1",
      status: "failed",
      roots: ["UserService"],
      diagnostics: [
        {
          code: "framework-context/di-missing-provider",
          severity: "error",
          token: "Token<database.url>",
          status: "missing",
          path: ["UserService", "Token<database.url>"],
        },
      ],
    });
    expect(Container.has(UserService)).toBe(false);
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
    const diagnostic = manifest.diagnostics.find(
      (entry) => entry.code === "framework-context/di-circular-dependency",
    );

    expect(manifest.status).toBe("failed");
    expect(diagnostic).toMatchObject({
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
        code: "framework-context/di-scope-mismatch",
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
        code: "framework-context/di-unknown-provider",
        token: "Repository",
      }),
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
