import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
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
});
