import { beforeEach, describe, expect, it } from "vitest";
import "reflect-metadata";
import {
  CircularDependencyProblem,
  Component,
  Container,
  ContainerDiagnosticsProvider,
  ContainerResolutionProblem,
  ContainerScopeMismatchProblem,
  Context,
  Inject,
  MetadataStorage,
  Token,
} from "../index";

describe("Container resolution diagnostics", () => {
  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
  });

  it("throws a stable Problem with a resolution trace for missing providers", () => {
    const token = new Token<string>("database.url");

    expect(() => Container.get(token)).toThrow(ContainerResolutionProblem);

    try {
      Container.get(token);
    } catch (error) {
      expect(error).toBeInstanceOf(ContainerResolutionProblem);
      expect((error as ContainerResolutionProblem).code).toBe(
        "framework-context/di-resolution-failed",
      );
      expect((error as ContainerResolutionProblem).reason).toBe("missing-provider");
      expect((error as ContainerResolutionProblem).detail).toContain(
        "DI resolution failed for Token<database.url>",
      );
      expect((error as ContainerResolutionProblem).trace).toMatchObject({
        root: "Token<database.url>",
        status: "missing",
        steps: [
          {
            token: "Token<database.url>",
            tokenKind: "typedi-token",
            provider: "missing",
            status: "missing",
            path: ["Token<database.url>"],
          },
        ],
      });
      return;
    }

    throw new Error("Expected Container.get to throw");
  });

  it("exposes a zero-side-effect provider selection trace", () => {
    class Repository {}

    class UserService {
      constructor(readonly repository: Repository) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], Repository);
    Reflect.defineMetadata("design:paramtypes", [Repository], UserService);
    Component({ scope: "transient" })(Repository);
    Component()(UserService);

    const trace = Container.getResolutionTrace(UserService);

    expect(trace).toMatchObject({
      root: "UserService",
      status: "ready",
      steps: [
        {
          token: "UserService",
          tokenKind: "constructor",
          provider: "component",
          scope: "singleton",
          status: "selected",
          path: ["UserService"],
        },
        {
          token: "Repository",
          tokenKind: "constructor",
          provider: "component",
          scope: "transient",
          status: "selected",
          dependencyOf: "UserService",
          parameterIndex: 0,
          path: ["UserService", "Repository"],
        },
      ],
    });

    expect(Container.has(UserService)).toBe(false);
  });

  it("fails before a singleton captures a request-scoped dependency", () => {
    class RequestRepository {}

    class UserService {
      constructor(readonly repository: RequestRepository) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], RequestRepository);
    Reflect.defineMetadata("design:paramtypes", [RequestRepository], UserService);
    Component({ scope: "request" })(RequestRepository);
    Component()(UserService);

    expect(() => Container.get(UserService)).toThrow(ContainerScopeMismatchProblem);

    try {
      Container.get(UserService);
    } catch (error) {
      expect(error).toBeInstanceOf(ContainerScopeMismatchProblem);
      expect((error as ContainerScopeMismatchProblem).code).toBe(
        "framework-context/di-scope-mismatch",
      );
      expect((error as ContainerScopeMismatchProblem).trace.status).toBe("scope-mismatch");
      expect((error as ContainerScopeMismatchProblem).detail).toContain(
        "Singleton-scoped component UserService cannot depend on request-scoped component RequestRepository",
      );
      return;
    }

    throw new Error("Expected Container.get to throw");
  });

  it("fails when @Inject resolves a request-scoped dependency for a singleton", () => {
    class RequestRepository {}

    class UserService {
      constructor(@Inject(() => RequestRepository) readonly repository: unknown) {}
    }

    Reflect.defineMetadata("design:paramtypes", [Object], UserService);
    Component({ scope: "request" })(RequestRepository);
    Component()(UserService);

    const trace = Container.getResolutionTrace(UserService);

    expect(trace).toMatchObject({
      root: "UserService",
      status: "scope-mismatch",
    });
    expect(trace.steps[trace.steps.length - 1]).toMatchObject({
      token: "RequestRepository",
      provider: "component",
      scope: "request",
      status: "scope-mismatch",
      dependencyOf: "UserService",
      parameterIndex: 0,
      path: ["UserService", "RequestRepository"],
    });

    expect(() => {
      Context.run({ requestId: "handler-scope" }, () => Container.get(UserService));
    }).toThrow(ContainerScopeMismatchProblem);
  });

  it("uses @Inject token metadata in side-effect-free provider traces", () => {
    const configToken = new Token<string>("handler.config");

    class ConfigConsumer {
      constructor(@Inject(configToken) readonly config: unknown) {}
    }

    Reflect.defineMetadata("design:paramtypes", [Object], ConfigConsumer);
    Component()(ConfigConsumer);
    Container.set(configToken, "configured");

    const trace = Container.getResolutionTrace(ConfigConsumer);

    expect(trace).toMatchObject({
      root: "ConfigConsumer",
      status: "ready",
      steps: [
        {
          token: "ConfigConsumer",
          provider: "component",
          scope: "singleton",
          status: "selected",
        },
        {
          token: "Token<handler.config>",
          tokenKind: "typedi-token",
          provider: "registered-value",
          status: "selected",
          dependencyOf: "ConfigConsumer",
          parameterIndex: 0,
          path: ["ConfigConsumer", "Token<handler.config>"],
        },
      ],
    });
    expect(Container.has(ConfigConsumer)).toBe(false);
  });

  it("detects runtime circular dependencies with the same trace model", () => {
    class ServiceA {
      constructor(readonly serviceB: ServiceB) {}
    }

    class ServiceB {
      constructor(readonly serviceA: ServiceA) {}
    }

    Reflect.defineMetadata("design:paramtypes", [ServiceB], ServiceA);
    Reflect.defineMetadata("design:paramtypes", [ServiceA], ServiceB);
    Component({ scope: "transient" })(ServiceA);
    Component({ scope: "transient" })(ServiceB);

    const trace = Container.getResolutionTrace(ServiceA);

    expect(trace).toMatchObject({
      root: "ServiceA",
      status: "circular",
    });
    expect(trace.steps[trace.steps.length - 1]).toMatchObject({
      token: "ServiceA",
      status: "circular",
      path: ["ServiceA", "ServiceB", "ServiceA"],
    });
    expect(() => Container.get(ServiceA)).toThrow(CircularDependencyProblem);
    expect(Container.getLastResolutionTrace()).toMatchObject({
      root: "ServiceA",
      status: "circular",
    });
  });

  it("records the last resolution trace for diagnostics providers", async () => {
    const token = new Token<string>("missing.config");

    expect(() => Container.get(token)).toThrow(ContainerResolutionProblem);

    const provider = new ContainerDiagnosticsProvider();
    const health = await provider.getHealth();

    expect(health.details).toMatchObject({
      lastResolutionTrace: {
        root: "Token<missing.config>",
        status: "missing",
      },
    });
  });
});
