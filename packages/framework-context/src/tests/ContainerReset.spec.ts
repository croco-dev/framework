import { afterEach, describe, expect, it, vi } from "vitest";
import { Problem } from "@croco/problems-core";
import { Container, GENERATED_DI_GRAPH_VERSION, Token, defineGeneratedDiGraph } from "../index";
import { Component } from "./registerTestComponent";

const SOURCE = { file: "src/reset.ts", line: 1, column: 1 } as const;

afterEach(() => Container.reset());

describe.each(["default", "application"] as const)("Container.reset in %s scope", (kind) => {
  it("normalizes a non-string Error.message without losing the original failure", () => {
    const scope = kind === "application" ? Container.createScope() : undefined;
    const failure = new Error("cleanup");
    Object.defineProperty(failure, "message", { value: BigInt(7) });
    const run = () => {
      Container.set("non-string-message", {
        destroy() {
          throw failure;
        },
      });
      let problem: unknown;
      try {
        Container.reset();
      } catch (error) {
        problem = error;
      }
      expect(problem).toMatchObject({ code: "framework-context/container-reset-failed" });
      expect(((problem as Problem).cause as AggregateError).errors[0]).toBe(failure);
      expect((problem as Problem).toJSON()).toMatchObject({
        cleanupFailures: [{ message: "7" }],
      });
    };
    try {
      if (scope) scope.run(run);
      else run();
    } finally {
      scope?.dispose();
    }
  });

  it.each([
    [100, 0],
    [101, 1],
    [5000, 4900],
  ])("keeps the complete cause within the extension budget (%i failures)", (count, omitted) => {
    const scope = kind === "application" ? Container.createScope() : undefined;
    const run = () => {
      const token = new Token<object>("many-transients");
      const originals: Error[] = [];
      const destroy = vi.fn((failure: Error) => {
        throw failure;
      });
      Container.installGeneratedGraph(
        defineGeneratedDiGraph({
          version: GENERATED_DI_GRAPH_VERSION,
          graphId: "reset.many-failures",
          compilerVersion: "test",
          inputHash: "input",
          roots: [],
          providers: [
            {
              token,
              tokenId: "app:many-transients",
              debugName: "many-transients",
              scope: "transient",
              dependencies: [],
              sourceLocation: SOURCE,
              factory: () => {
                const failure = new Error(`cleanup ${originals.length}`);
                originals.push(failure);
                return { destroy: () => destroy(failure) };
              },
            },
          ],
        }),
      );
      for (let index = 0; index < count; index++) Container.get(token);
      let problem: unknown;
      try {
        Container.reset();
      } catch (error) {
        problem = error;
      }
      expect(problem).toMatchObject({ code: "framework-context/container-reset-failed" });
      expect(destroy).toHaveBeenCalledTimes(count);
      const cause = (problem as Problem).cause as AggregateError;
      expect(cause.errors).toHaveLength(count);
      expect(
        cause.errors.every(
          (failure: unknown, index: number) => failure === originals[count - index - 1],
        ),
      ).toBe(true);
      const summary = (problem as Problem).toJSON();
      expect(summary).toMatchObject({
        cleanupFailureCount: count,
        omittedCleanupFailureCount: omitted,
      });
      expect(summary.cleanupFailures).toEqual(
        originals
          .slice()
          .reverse()
          .slice(0, 100)
          .map((failure) => ({ message: failure.message })),
      );
      expect(() => JSON.stringify(summary)).not.toThrow();
      expect(Container.has(token)).toBe(false);
      expect(() => Container.reset()).not.toThrow();
      expect(destroy).toHaveBeenCalledTimes(count);
    };
    try {
      if (scope) scope.run(run);
      else run();
    } finally {
      scope?.dispose();
    }
  });

  it("clears manual registrations before generated cleanup and disposes a singleton first resolved there", () => {
    const scope = kind === "application" ? Container.createScope() : undefined;
    const run = () => {
      const manualToken = new Token<object>("manual-phase");
      const transientToken = new Token<object>("transient-phase");
      const singletonToken = new Token<object>("late-singleton");
      const singleton = { destroy: vi.fn() };
      let manualVisibleDuringCleanup: boolean | undefined;
      Container.set(manualToken, {
        destroy() {
          throw new Error("manual phase failed");
        },
      });
      Container.installGeneratedGraph(
        defineGeneratedDiGraph({
          version: GENERATED_DI_GRAPH_VERSION,
          graphId: "reset.phases",
          compilerVersion: "test",
          inputHash: "input",
          roots: [],
          providers: [
            {
              token: transientToken,
              tokenId: "app:transient-phase",
              debugName: "transient-phase",
              scope: "transient",
              dependencies: [],
              sourceLocation: SOURCE,
              factory: () => ({
                destroy() {
                  manualVisibleDuringCleanup = Container.has(manualToken);
                  Container.get(singletonToken);
                },
              }),
            },
            {
              token: singletonToken,
              tokenId: "app:late-singleton",
              debugName: "late-singleton",
              scope: "singleton",
              dependencies: [],
              sourceLocation: SOURCE,
              factory: () => singleton,
            },
          ],
        }),
      );
      Container.get(transientToken);
      expect(() => Container.reset()).toThrow(Problem);
      expect(manualVisibleDuringCleanup).toBe(false);
      expect(singleton.destroy).toHaveBeenCalledTimes(1);
      expect(() => Container.reset()).not.toThrow();
      expect(singleton.destroy).toHaveBeenCalledTimes(1);
    };
    try {
      if (scope) scope.run(run);
      else run();
    } finally {
      scope?.dispose();
    }
  });

  it("preserves an unprintable thrown value without losing the reset Problem", () => {
    const scope = kind === "application" ? Container.createScope() : undefined;
    const failure = Object.create(null) as object;
    const run = () => {
      Container.set("unprintable", {
        destroy() {
          throw failure;
        },
      });
      let problem: unknown;
      try {
        Container.reset();
      } catch (error) {
        problem = error;
      }
      expect(problem).toBeInstanceOf(Problem);
      expect(problem).toMatchObject({ code: "framework-context/container-reset-failed" });
      expect(((problem as Problem).cause as AggregateError).errors[0]).toBe(failure);
      expect((problem as Problem).toJSON()).toMatchObject({
        cleanupFailures: [{ message: "Provider cleanup threw an unprintable value." }],
      });
      expect(Container.has("unprintable")).toBe(false);
    };
    try {
      if (scope) scope.run(run);
      else run();
    } finally {
      scope?.dispose();
    }
  });

  it("releases every lifetime and registration after multiple cleanup failures", () => {
    const scope = kind === "application" ? Container.createScope() : undefined;
    const run = () => {
      const manualFailure = new Error("manual cleanup failed");
      const secondFailure = new Error("second manual cleanup failed");
      const singletonFailure = new Error("singleton cleanup failed");
      const manual = {
        destroy: vi.fn(() => {
          throw manualFailure;
        }),
      };
      const second = {
        destroy: vi.fn(() => {
          throw secondFailure;
        }),
      };
      const transient = {
        [Symbol.dispose]: vi.fn(() => {
          throw "transient cleanup failed";
        }),
      };
      const singleton = {
        destroy: vi.fn(() => {
          throw singletonFailure;
        }),
      };
      const healthy = { destroy: vi.fn() };
      const manualToken = new Token<object>("manual");
      const alias = Symbol("alias");
      const transientToken = new Token<object>("transient");
      const singletonToken = new Token<object>("singleton");
      const healthyToken = new Token<object>("healthy");
      const lazyToken = new Token<object>("lazy");
      class Decorated {}
      Component()(Decorated);
      Container.set(manualToken, manual);
      Container.set(alias, manual);
      Container.set("second", second);
      Container.registerLazy(lazyToken, () => healthy);
      const symbolIdentity = Container.toServiceIdentifier(alias);
      const graph = defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "reset.graph",
        compilerVersion: "test",
        inputHash: "input",
        roots: [],
        providers: [
          {
            token: transientToken,
            tokenId: "app:transient",
            debugName: "transient",
            scope: "transient",
            dependencies: [],
            factory: () => transient,
            sourceLocation: SOURCE,
          },
          {
            token: singletonToken,
            tokenId: "app:singleton",
            debugName: "singleton",
            scope: "singleton",
            dependencies: [],
            factory: () => singleton,
            sourceLocation: SOURCE,
          },
          {
            token: healthyToken,
            tokenId: "app:healthy",
            debugName: "healthy",
            scope: "singleton",
            dependencies: [],
            factory: () => healthy,
            sourceLocation: SOURCE,
          },
          {
            token: new Token<object>("shared"),
            tokenId: "app:shared",
            debugName: "shared",
            scope: "singleton",
            dependencies: [],
            factory: () => manual,
            sourceLocation: SOURCE,
          },
        ],
      });
      Container.installGeneratedGraph(graph);
      Container.get(transientToken);
      Container.get(singletonToken);
      Container.get(healthyToken);
      Container.get(graph.providers[3].token);
      let failure: unknown;
      try {
        Container.reset();
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(Problem);
      expect(failure).toMatchObject({ code: "framework-context/container-reset-failed" });
      expect((failure as Problem).cause).toBeInstanceOf(AggregateError);
      expect(((failure as Problem).cause as AggregateError).errors).toEqual([
        secondFailure,
        manualFailure,
        "transient cleanup failed",
        singletonFailure,
      ]);
      expect((failure as Problem).toJSON()).toMatchObject({
        cleanupFailureCount: 4,
        omittedCleanupFailureCount: 0,
        cleanupFailures: [
          { message: "second manual cleanup failed" },
          { message: "manual cleanup failed" },
          { message: "transient cleanup failed" },
          { message: "singleton cleanup failed" },
        ],
      });
      for (const dispose of [
        manual.destroy,
        second.destroy,
        transient[Symbol.dispose],
        singleton.destroy,
        healthy.destroy,
      ])
        expect(dispose).toHaveBeenCalledTimes(1);
      for (const token of [
        manualToken,
        alias,
        "second",
        transientToken,
        singletonToken,
        healthyToken,
        lazyToken,
        Decorated,
      ])
        expect(Container.has(token)).toBe(false);
      expect(Container.createDependencyGraphManifest()).toMatchObject({ roots: [], providers: [] });
      expect(Container.toServiceIdentifier(alias)).not.toBe(symbolIdentity);
      expect(Container.getLastResolutionTrace()).toBeUndefined();
      expect(() => Container.reset()).not.toThrow();
      expect(manual.destroy).toHaveBeenCalledTimes(1);
      const replacement = { destroy: vi.fn() };
      Container.installGeneratedGraph({
        ...graph,
        providers: graph.providers.map((provider) => ({ ...provider, factory: () => replacement })),
      });
      expect(Container.get(singletonToken)).toBe(replacement);
      Container.reset();
      expect(replacement.destroy).toHaveBeenCalledTimes(1);
    };
    try {
      if (scope) scope.run(run);
      else run();
    } finally {
      scope?.dispose();
    }
  });
});
