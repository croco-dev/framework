import { beforeEach, describe, expect, it } from "vitest";
import { Problem } from "@croco/problems-core";
import {
  CannotInstantiateValueError,
  Container,
  ContainerInstance,
  ContainerResolutionProblem,
  RuntimeContainer,
  ServiceNotFoundError,
  Token,
  Inject,
  defineGeneratedDiGraph,
  GENERATED_DI_GRAPH_VERSION,
} from "../index";

describe("Runtime container resolution Problems", () => {
  beforeEach(() => Container.reset());

  it.each(["missing", Symbol("missing"), new Token("missing"), class Missing {}])(
    "retains public missing-service compatibility and structured diagnostics for %s",
    (identifier) => {
      let failure: unknown;
      try {
        RuntimeContainer.get(identifier);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(ServiceNotFoundError);
      expect(failure).toBeInstanceOf(ContainerResolutionProblem);
      expect(failure).toBeInstanceOf(Problem);
      expect(failure).toMatchObject({
        name: "ServiceNotFoundError",
        identifier,
        code: "framework-context/di-resolution-failed",
        reason: "missing-provider",
        trace: { status: "missing", steps: [{ provider: "missing", status: "missing" }] },
      });
      expect((failure as Problem).toJSON()).toMatchObject({
        code: "framework-context/di-resolution-failed",
        reason: "missing-provider",
        resolution: (failure as ContainerResolutionProblem).trace,
      });
    },
  );

  it("distinguishes an unusable registration from an absent provider", () => {
    const identifier = new Token("unusable");
    const container = new ContainerInstance("unusable-test");
    container.set({ id: identifier });
    expect(() => container.get(identifier)).toThrow(CannotInstantiateValueError);
    try {
      container.get(identifier);
    } catch (error) {
      expect(error).toBeInstanceOf(ContainerResolutionProblem);
      expect(error).toMatchObject({
        name: "CannotInstantiateValueError",
        identifier,
        code: "framework-context/di-resolution-failed",
        reason: "not-instantiable",
        trace: { root: "Token<unusable>", status: "failed", steps: [{ status: "uninspectable" }] },
      });
    }
  });

  it("reports unresolved constructor metadata as not-instantiable", () => {
    class NeedsDependency {
      constructor(readonly value: unknown) {}
    }
    const container = new ContainerInstance("constructor-test");
    container.set({ id: NeedsDependency, type: NeedsDependency });
    expect(() => container.get(NeedsDependency)).toThrow(CannotInstantiateValueError);
    try {
      container.get(NeedsDependency);
    } catch (error) {
      expect(error).toMatchObject({
        reason: "not-instantiable",
        trace: { root: "NeedsDependency", status: "failed" },
      });
    }
  });

  it("retains missing dependency identity from runtime constructor injection", () => {
    const token = new Token("dependency");
    class Consumer {
      constructor(@Inject(token) readonly dependency: unknown) {}
    }
    const container = new ContainerInstance("dependency-test");
    container.set({ id: Consumer, type: Consumer });
    expect(() => container.get(Consumer)).toThrow(ServiceNotFoundError);
    try {
      container.get(Consumer);
    } catch (error) {
      expect(error).toMatchObject({
        identifier: token,
        reason: "missing-provider",
        trace: { root: "Token<dependency>" },
      });
    }
  });

  it.each(["missing-provider", "not-instantiable"] as const)(
    "preserves an existing structured %s Problem and its trace",
    (reason) => {
      const token = new Token("structured.factory");
      const trace = { root: "original-dependency", status: "failed", steps: [] } as const;
      const failure = new ContainerResolutionProblem("original failure", trace, reason);
      Container.registerLazy(token, () => {
        throw failure;
      });
      try {
        Container.get(token);
        expect.fail("Expected resolution to fail");
      } catch (error) {
        expect(error).toBe(failure);
        expect(Container.getLastResolutionTrace()).toEqual(trace);
      }
    },
  );

  it("preserves the runtime cause and failure reason at the Container boundary", () => {
    const token = new Token("unusable.factory");
    const failure = new CannotInstantiateValueError(token);
    Container.registerLazy(token, () => {
      throw failure;
    });
    expect(() => Container.get(token)).toThrow(ContainerResolutionProblem);
    try {
      Container.get(token);
    } catch (error) {
      expect(error).toMatchObject({
        code: "framework-context/di-resolution-failed",
        reason: "not-instantiable",
        cause: failure,
        trace: { root: "Token<unusable.factory>", status: "failed", steps: [{ provider: "lazy" }] },
      });
    }
  });

  it.each(["missing-provider", "not-instantiable"] as const)(
    "retains the inner runtime token in a nested %s failure",
    (reason) => {
      const outer = new Token("outer");
      const inner = new Token("inner");
      const runtime = new ContainerInstance("nested-runtime");
      if (reason === "not-instantiable") {
        runtime.set({ id: inner });
      }
      Container.registerLazy(outer, () => runtime.get(inner));
      try {
        Container.get(outer);
        expect.fail("Expected nested resolution to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(ContainerResolutionProblem);
        const failure = error as ContainerResolutionProblem;
        expect(failure.reason).toBe(reason);
        expect(failure.trace.root).toBe("Token<outer>");
        expect(failure.trace.steps.map((step) => step.token)).toEqual([
          "Token<outer>",
          "Token<inner>",
        ]);
        const [outerStep, innerStep] = failure.trace.steps;
        expect(innerStep).toMatchObject({
          path: ["Token<outer>", "Token<inner>"],
          pathIds: [outerStep?.tokenId, innerStep?.tokenId],
          dependencyOf: "Token<outer>",
          dependencyOfId: outerStep?.tokenId,
          status: reason === "missing-provider" ? "missing" : "uninspectable",
        });
        expect(failure.detail).toContain("Token<outer> -> Token<inner>");
        expect(Container.getLastResolutionTrace()).toEqual(failure.trace);
        expect(failure.cause).toMatchObject({ identifier: inner, reason });
      }
    },
  );

  it.each(["get", "getMany"] as const)(
    "preserves the active dependency occurrence through %s",
    (method) => {
      const outer = new Token("outer");
      const shared = new Token("shared");
      const middle = new Token("middle");
      const sourceLocation = { file: "nested-runtime.ts" };
      const runtime = new ContainerInstance("separate-runtime");
      Container.set(shared, "ready");
      Container.registerLazy(middle, () => runtime.get(shared));
      Container.installGeneratedGraph(
        defineGeneratedDiGraph({
          version: GENERATED_DI_GRAPH_VERSION,
          graphId: "nested-runtime",
          compilerVersion: "test",
          inputHash: "nested-runtime",
          roots: [outer],
          providers: [
            {
              token: outer,
              tokenId: "app:outer",
              debugName: "outer",
              scope: "singleton",
              dependencies: [shared, middle].map((token, parameterIndex) => ({
                token,
                tokenId: `app:${parameterIndex}`,
                parameterIndex,
                sourceLocation,
              })),
              factory: (resolver) => {
                resolver.get(shared);
                return resolver.get(middle);
              },
              sourceLocation,
            },
          ],
        }),
      );
      try {
        if (method === "get") {
          Container.get(outer);
        } else {
          Container.getMany(outer);
        }
        expect.fail("Expected nested resolution to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(ContainerResolutionProblem);
        const failure = error as ContainerResolutionProblem;
        const sharedSteps = failure.trace.steps.filter((step) => step.token === "Token<shared>");
        expect(sharedSteps).toHaveLength(2);
        expect(sharedSteps[0]).toMatchObject({
          provider: "registered-value",
          status: "selected",
          path: ["Token<outer>", "Token<shared>"],
        });
        expect(sharedSteps[1]).toMatchObject({
          provider: "missing",
          status: "missing",
          path: ["Token<outer>", "Token<middle>", "Token<shared>"],
          dependencyOf: "Token<middle>",
        });
        expect(sharedSteps[1]?.tokenId).toBe(sharedSteps[0]?.tokenId);
        expect(failure.detail).toContain("Token<outer> -> Token<middle> -> Token<shared>");
        expect(Container.getLastResolutionTrace()).toEqual(failure.trace);
        expect(Container.get(shared)).toBe("ready");
      }
    },
  );

  it("reports the failing dependency when a later sibling exists in the planned trace", () => {
    const outer = new Token("outer");
    const first = new Token("first");
    const later = new Token("later");
    const sourceLocation = { file: "nested-runtime.ts" };
    const runtime = new ContainerInstance("sibling-runtime");
    Container.set(later, "ready");
    Container.registerLazy(first, () => runtime.get(first));
    Container.installGeneratedGraph(
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "sibling-runtime",
        compilerVersion: "test",
        inputHash: "sibling-runtime",
        roots: [outer],
        providers: [
          {
            token: outer,
            tokenId: "app:outer",
            debugName: "outer",
            scope: "transient",
            dependencies: [first, later].map((token, parameterIndex) => ({
              token,
              tokenId: `app:${parameterIndex}`,
              sourceLocation,
            })),
            factory: (resolver) => resolver.get(first),
            sourceLocation,
          },
        ],
      }),
    );
    try {
      Container.get(outer);
      expect.fail("Expected nested resolution to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ContainerResolutionProblem);
      const failure = error as ContainerResolutionProblem;
      expect(failure.detail).toContain("Resolution path: Token<outer> -> Token<first>.");
      expect(failure.trace.steps.at(-1)).toMatchObject({
        token: "Token<first>",
        status: "missing",
        path: ["Token<outer>", "Token<first>"],
      });
    }
  });

  it("preserves nested generated multi-provider runtime failures", () => {
    const outer = new Token("outer");
    const middle = new Token("middle");
    const inner = new Token("inner");
    const sourceLocation = { file: "nested-runtime.ts" };
    const runtime = new ContainerInstance("multi-runtime");
    Container.installGeneratedGraph(
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "multi-runtime",
        compilerVersion: "test",
        inputHash: "multi-runtime",
        roots: [outer],
        providers: [
          {
            token: outer,
            tokenId: "app:outer",
            debugName: "outer",
            scope: "transient",
            dependencies: [{ token: middle, tokenId: "app:middle", many: true, sourceLocation }],
            factory: (resolver) => resolver.getMany(middle),
            sourceLocation,
          },
          {
            token: middle,
            tokenId: "app:middle",
            debugName: "middle",
            scope: "transient",
            multiple: true,
            dependencies: [],
            factory: () => runtime.get(inner),
            sourceLocation,
          },
        ],
      }),
    );
    try {
      Container.get(outer);
      expect.fail("Expected nested resolution to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ContainerResolutionProblem);
      const failure = error as ContainerResolutionProblem;
      expect(failure.trace.steps.at(-1)).toMatchObject({
        token: "Token<inner>",
        path: ["Token<outer>", "Token<middle>", "Token<inner>"],
        dependencyOf: "Token<middle>",
        status: "missing",
      });
      expect(failure.detail).toContain("Token<outer> -> Token<middle> -> Token<inner>");
    }
  });

  it.each(["ServiceNotFoundError", "CannotInstantiateValueError"])(
    "does not classify a constructor error by its name %s",
    (name) => {
      const identifier = new Token("factory");
      const failure = new Error("factory failed");
      failure.name = name;
      Container.registerLazy(identifier, () => {
        throw failure;
      });
      expect(() => Container.get(identifier)).toThrow(ContainerResolutionProblem);
      try {
        Container.get(identifier);
      } catch (error) {
        expect(error).toMatchObject({ reason: "construction-failed", cause: failure });
      }
    },
  );
});
