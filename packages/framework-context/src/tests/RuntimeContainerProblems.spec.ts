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
