import { afterEach, describe, expect, it } from "vitest";
import { Container, GENERATED_DI_GRAPH_VERSION, Token, defineGeneratedDiGraph } from "../index";
import type { GeneratedProviderDefinition } from "../index";

const SOURCE = { file: "src/services.ts", line: 7, column: 3 } as const;

function graph(graphId: string, providers: readonly GeneratedProviderDefinition[]) {
  return defineGeneratedDiGraph({
    version: GENERATED_DI_GRAPH_VERSION,
    graphId,
    compilerVersion: "test",
    inputHash: graphId,
    roots: providers.map((provider) => provider.token),
    providers,
  });
}

function singleton(
  token: GeneratedProviderDefinition["token"],
  tokenId: string,
  factory: () => unknown,
  dependencies: GeneratedProviderDefinition["dependencies"] = [],
): GeneratedProviderDefinition {
  return {
    token,
    tokenId,
    debugName: tokenId,
    scope: "singleton",
    dependencies,
    factory,
    sourceLocation: SOURCE,
  };
}

describe("generated provider removal", () => {
  afterEach(() => Container.reset());

  describe.each(["root", "application"] as const)("%s container", (target) => {
    it("retains a disposable function until its last runtime binding is removed", () => {
      let disposed = 0;
      const value = Object.assign(() => undefined, {
        [Symbol.dispose]: () => {
          disposed += 1;
        },
      });
      const FIRST = new Token<typeof value>("first-function");
      const LAST = new Token<typeof value>("last-function");
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.set(FIRST, value);
        Container.set(LAST, value);
        Container.remove(FIRST);
        expect(disposed).toBe(0);
        expect(Container.get(LAST)).toBe(value);
        Container.remove(LAST);
        expect(disposed).toBe(1);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        scope?.dispose();
      }
      expect(disposed).toBe(1);
    });

    it("attempts every removed singleton cleanup and preserves all failures without retrying", () => {
      const MULTI = new Token<object>("failing-multi");
      const failures = [new Error("first cleanup"), new Error("second cleanup")];
      const disposed = [0, 0];
      let fail = true;
      const original = graph(
        "failing-multi",
        failures.map((failure, index) => ({
          ...singleton(MULTI, "app:failing-multi", () => ({
            destroy: () => {
              disposed[index] = (disposed[index] ?? 0) + 1;
              if (fail) throw failure;
            },
          })),
          multiple: true,
        })),
      );
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(original);
        Container.getMany(MULTI);
        let observed: unknown;
        try {
          Container.remove(MULTI);
        } catch (error) {
          observed = error;
        }
        expect(Container.has(MULTI)).toBe(false);
        expect(disposed).toEqual([1, 1]);
        expect(observed).toMatchObject({
          code: "framework-context/container-provider-cleanup-failed",
          extensions: { cleanupFailureCount: 2, retryable: false },
        });
        expect(observed).toHaveProperty("cause.errors", failures);
        Container.remove(MULTI);
        Container.removeGeneratedGraph("failing-multi");
        expect(disposed).toEqual([1, 1]);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        fail = false;
        scope?.dispose();
      }
      expect(disposed).toEqual([1, 1]);
    });

    it("releases a shared singleton when its last runtime binding is replaced", () => {
      let disposed = 0;
      const shared = {
        destroy: () => {
          disposed += 1;
        },
      };
      const SERVICE = new Token<object>("service");
      const FIRST = new Token<object>("first");
      const LAST = new Token<object>("last");
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(
          graph("shared", [singleton(SERVICE, "app:service", () => shared)]),
        );
        Container.get(SERVICE);
        Container.set(FIRST, shared);
        Container.set(LAST, shared);
        Container.remove(SERVICE);
        Container.set(FIRST, {});
        expect(disposed).toBe(0);
        expect(Container.get(LAST)).toBe(shared);
        Container.set(LAST, {});
        expect(disposed).toBe(1);
        Container.remove(FIRST);
        Container.remove(LAST);
        expect(disposed).toBe(1);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        scope?.dispose();
      }
    });

    it("finishes generated removal before propagating a runtime destructor failure", () => {
      const failure = new Error("runtime cleanup failed");
      let disposed = 0;
      const SERVICE = new Token<object>("service");
      const generated = {
        destroy: () => {
          disposed += 1;
        },
      };
      const runtime = {
        destroy: () => {
          throw failure;
        },
      };
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(
          graph("service", [singleton(SERVICE, "app:service", () => generated)]),
        );
        Container.get(SERVICE);
        Container.set(SERVICE, runtime);
        Container.registerLazy(SERVICE, () => runtime);
        let observed: unknown;
        try {
          Container.remove(SERVICE);
        } catch (error) {
          observed = error;
        }
        expect(Container.has(SERVICE)).toBe(false);
        expect(Container.getOptional(SERVICE)).toBeUndefined();
        expect(disposed).toBe(1);
        expect(observed).toMatchObject({
          code: "framework-context/container-provider-cleanup-failed",
          extensions: { retryable: false, cleanupFailureCount: 1 },
        });
        expect(observed).toHaveProperty("cause.errors", [failure]);
        Container.installGeneratedGraph(graph("unrelated", []));
        expect(Container.has(SERVICE)).toBe(false);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        scope?.dispose();
      }
    });

    it.each(["token", "graph"] as const)(
      "preserves registrations and instances when %s removal fails graph validation",
      (kind) => {
        let generatedDisposed = 0;
        let runtimeDisposed = 0;
        const X = new Token<object>("x");
        const B = new Token<object>("b");
        const Y = new Token<object>("y");
        const generated = {
          destroy: () => {
            generatedDisposed += 1;
          },
        };
        const runtime = {
          destroy: () => {
            runtimeDisposed += 1;
          },
        };
        const scope = target === "application" ? Container.createScope() : undefined;
        const run = () => {
          Container.installGeneratedGraph(graph("a-first", [singleton(X, "app:a", () => ({}))]));
          Container.installGeneratedGraph(
            graph("b-middle", [
              singleton(B, "app:b", () => generated, [{ token: X, tokenId: "app:z" }]),
            ]),
          );
          Container.installGeneratedGraph(graph("c-last", [singleton(Y, "app:a", () => ({}))]));
          Container.get(B);
          const retainedY = Container.get(Y);
          Container.set(B, runtime);
          expect(() =>
            kind === "token" ? Container.remove(B) : Container.removeGeneratedGraph("b-middle"),
          ).toThrow(/owned by more than one/);
          expect(Container.has(B)).toBe(true);
          expect(Container.get(B)).toBe(runtime);
          expect(Container.get(Y)).toBe(retainedY);
          expect(generatedDisposed).toBe(0);
          expect(runtimeDisposed).toBe(0);
          Container.installGeneratedGraph(graph("unrelated", []));
          expect(Container.get(B)).toBe(runtime);
        };
        try {
          if (scope) scope.run(run);
          else run();
        } finally {
          scope?.dispose();
        }
      },
    );

    it("keeps a removed singleton absent through unrelated graph changes until explicit reinstall", () => {
      let disposed = 0;
      class Service {
        [Symbol.dispose](): void {
          disposed += 1;
        }
      }
      const KEEP = new Token<object>("keep");
      const original = graph("original", [
        {
          token: Service,
          tokenId: "app:Service",
          debugName: "Service",
          kind: "rest-controller",
          scope: "singleton",
          dependencies: [],
          factory: () => new Service(),
          sourceLocation: SOURCE,
        },
        {
          token: KEEP,
          tokenId: "app:keep",
          debugName: "keep",
          scope: "singleton",
          dependencies: [],
          factory: () => ({}),
          sourceLocation: SOURCE,
        },
      ]);
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(original);
        const instance = Container.get(Service);
        const kept = Container.get(KEEP);
        Container.remove(Service);

        expect(Container.has(Service)).toBe(false);
        expect(disposed).toBe(1);
        expect(Container.getComponentMetadata(Service)).toBeUndefined();
        expect(Container.getGeneratedProviderTokens("rest-controller")).toEqual([]);
        expect(() => Container.get(Service)).toThrow();

        Container.installGeneratedGraph(graph("unrelated", []));
        Container.removeGeneratedGraph("unrelated");
        expect(Container.has(Service)).toBe(false);
        expect(() => Container.get(Service)).toThrow();
        expect(Container.get(KEEP)).toBe(kept);
        Container.remove(Service);
        expect(disposed).toBe(1);

        Container.installGeneratedGraph(original);
        expect(Container.get(Service)).not.toBe(instance);
        expect(Container.get(KEEP)).toBe(kept);
        expect(Container.createDependencyGraphManifest({ roots: [Service] })).toMatchObject({
          status: "ready",
          rootIds: ["app:Service"],
        });
        expect(Container.getComponentMetadata(Service)?.scope).toBe("singleton");
        expect(original.providers).toHaveLength(2);
        Container.removeGeneratedGraph("original");
        expect(disposed).toBe(2);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        scope?.dispose();
      }
      expect(disposed).toBe(2);
    });

    it("removes every multi binding while retaining a shared singleton owned by another token", () => {
      let disposed = 0;
      const shared = {
        destroy: () => {
          disposed += 1;
        },
      };
      const other = {
        destroy: () => {
          disposed += 10;
        },
      };
      const MULTI = new Token<object>("multi");
      const KEEP = new Token<object>("keep");
      const provider = (
        token: Token<object>,
        value: object,
        multiple = false,
      ): GeneratedProviderDefinition => ({
        token,
        tokenId: token === MULTI ? "app:multi" : "app:keep",
        debugName: token === MULTI ? "multi" : "keep",
        scope: "singleton",
        multiple,
        dependencies: [],
        factory: () => value,
        sourceLocation: SOURCE,
      });
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(graph("first", [provider(MULTI, shared, true)]));
        Container.installGeneratedGraph(
          graph("second", [provider(MULTI, other, true), provider(KEEP, shared)]),
        );
        expect(Container.getMany(MULTI)).toEqual([shared, other]);
        expect(Container.get(KEEP)).toBe(shared);

        Container.remove(MULTI);
        expect(disposed).toBe(10);
        expect(Container.getMany(MULTI)).toEqual([]);
        Container.installGeneratedGraph(graph("unrelated", []));
        Container.removeGeneratedGraph("unrelated");
        expect(Container.has(MULTI)).toBe(false);
        expect(Container.get(KEEP)).toBe(shared);
        Container.remove(KEEP);
        expect(disposed).toBe(11);
        Container.removeGeneratedGraph("first");
        Container.removeGeneratedGraph("second");
        expect(disposed).toBe(11);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        scope?.dispose();
      }
      expect(disposed).toBe(11);
    });

    it.each(["same token", "another token"] as const)(
      "preserves runtime ownership for %s",
      (binding) => {
        let disposed = 0;
        const shared = {
          destroy: () => {
            disposed += 1;
          },
        };
        const SERVICE = new Token<object>("service");
        const KEEP = new Token<object>("keep");
        const scope = target === "application" ? Container.createScope() : undefined;
        const run = () => {
          Container.installGeneratedGraph(
            graph("original", [
              {
                token: SERVICE,
                tokenId: "app:service",
                debugName: "service",
                scope: "singleton",
                dependencies: [],
                factory: () => shared,
                sourceLocation: SOURCE,
              },
            ]),
          );
          expect(Container.get(SERVICE)).toBe(shared);
          Container.set(binding === "same token" ? SERVICE : KEEP, shared);
          Container.remove(SERVICE);
          expect(disposed).toBe(binding === "same token" ? 1 : 0);
          if (binding === "another token") {
            expect(Container.get(KEEP)).toBe(shared);
            Container.remove(KEEP);
          }
          expect(disposed).toBe(1);
          Container.removeGeneratedGraph("original");
        };
        try {
          if (scope) scope.run(run);
          else run();
        } finally {
          scope?.dispose();
        }
        expect(disposed).toBe(1);
      },
    );
  });

  it.each(["commit", "rollback"] as const)(
    "retains a replaced runtime baseline until transaction %s",
    async (outcome) => {
      const scope = Container.createScope();
      const SERVICE = new Token<object>("runtime-baseline");
      let baselineDisposed = 0;
      let replacementDisposed = 0;
      const baseline = {
        destroy: () => {
          baselineDisposed += 1;
        },
      };
      const replacement = {
        destroy: () => {
          replacementDisposed += 1;
        },
      };
      const failure = new Error("rollback replacement");
      scope.run(() => Container.set(SERVICE, baseline));
      try {
        const attempt = scope.runWithRollback(async () => {
          Container.set(SERVICE, replacement);
          expect(baselineDisposed).toBe(0);
          if (outcome === "rollback") throw failure;
        });
        if (outcome === "rollback") {
          await expect(attempt).rejects.toBe(failure);
          expect(scope.run(() => Container.get(SERVICE))).toBe(baseline);
          expect(baselineDisposed).toBe(0);
          expect(replacementDisposed).toBe(1);
        } else {
          await attempt;
          expect(scope.run(() => Container.get(SERVICE))).toBe(replacement);
          expect(baselineDisposed).toBe(1);
          expect(replacementDisposed).toBe(0);
        }
      } finally {
        scope.dispose();
      }
      expect(baselineDisposed).toBe(1);
      expect(replacementDisposed).toBe(1);
    },
  );

  it("keeps committed replacement bindings when retiring their prior value fails cleanup", async () => {
    const scope = Container.createScope();
    const SERVICE = new Token<object>("committed-cleanup-failure");
    const failure = new Error("prior value cleanup");
    let disposed = 0;
    const previous = {
      destroy: () => {
        disposed += 1;
        throw failure;
      },
    };
    const replacement = {};
    scope.run(() => Container.set(SERVICE, previous));
    try {
      await expect(
        scope.runWithRollback(async () => {
          Container.set(SERVICE, replacement);
        }),
      ).rejects.toMatchObject({
        code: "framework-context/container-provider-cleanup-failed",
        extensions: { retryable: false, cleanupFailureCount: 1 },
        cause: expect.objectContaining({ errors: [failure] }),
      });
      expect(scope.run(() => Container.get(SERVICE))).toBe(replacement);
      expect(disposed).toBe(1);
    } finally {
      scope.dispose();
    }
    expect(disposed).toBe(1);
  });

  it("reports every deferred cleanup failure while preserving the original rollback cause", async () => {
    const scope = Container.createScope();
    const SERVICE = new Token<object>("rollback-cleanup-failures");
    const disposed: string[] = [];
    const failures = [new Error("first deferred cleanup"), new Error("second deferred cleanup")];
    const baseline = { destroy: () => disposed.push("baseline") };
    const first = {
      destroy: () => {
        disposed.push("first");
        throw failures[0];
      },
    };
    const second = {
      destroy: () => {
        disposed.push("second");
        throw failures[1];
      },
    };
    const current = { destroy: () => disposed.push("current") };
    const failure = new Error("original rollback");
    scope.run(() => Container.set(SERVICE, baseline));
    let observed: unknown;
    try {
      try {
        await scope.runWithRollback(async () => {
          Container.set(SERVICE, first);
          Container.set(SERVICE, second);
          Container.set(SERVICE, current);
          throw failure;
        });
      } catch (error) {
        observed = error;
      }
      expect(observed).toMatchObject({
        code: "framework-context/container-scope-rollback-failed",
        cause: failure,
        extensions: {
          cleanupFailures: expect.arrayContaining([
            expect.objectContaining({ message: "first deferred cleanup" }),
            expect.objectContaining({ message: "second deferred cleanup" }),
          ]),
        },
      });
      expect(observed).toHaveProperty("extensions.cleanupFailures.length", 2);
      expect(scope.run(() => Container.get(SERVICE))).toBe(baseline);
      expect(disposed.sort()).toEqual(["current", "first", "second"]);
    } finally {
      scope.dispose();
    }
    expect(disposed.sort()).toEqual(["baseline", "current", "first", "second"]);
  });

  it("cleans intermediate replacements once when rollback restores its original binding", async () => {
    const scope = Container.createScope();
    const SERVICE = new Token<object>("repeated-replacement");
    const disposed: string[] = [];
    const baseline = { destroy: () => disposed.push("baseline") };
    const first = { destroy: () => disposed.push("first") };
    const second = { destroy: () => disposed.push("second") };
    const failure = new Error("rollback replacements");
    scope.run(() => Container.set(SERVICE, baseline));
    try {
      await expect(
        scope.runWithRollback(async () => {
          Container.set(SERVICE, first);
          Container.set(SERVICE, second);
          Container.set(SERVICE, first);
          throw failure;
        }),
      ).rejects.toBe(failure);
      expect(disposed.sort()).toEqual(["first", "second"]);
      expect(scope.run(() => Container.get(SERVICE))).toBe(baseline);
    } finally {
      scope.dispose();
    }
    expect(disposed.sort()).toEqual(["baseline", "first", "second"]);
  });

  it.each(["commit", "rollback"] as const)(
    "does not repeat intermediate cleanup after removing its last alias before %s",
    async (outcome) => {
      const scope = Container.createScope();
      const SERVICE = new Token<object>("replacement-owner");
      const ALIAS = new Token<object>("replacement-alias");
      const disposed: string[] = [];
      const baseline = { destroy: () => disposed.push("baseline") };
      const intermediate = { destroy: () => disposed.push("intermediate") };
      const replacement = { destroy: () => disposed.push("replacement") };
      const failure = new Error("rollback after alias removal");
      scope.run(() => Container.set(SERVICE, baseline));
      try {
        const attempt = scope.runWithRollback(async () => {
          Container.set(SERVICE, intermediate);
          Container.set(ALIAS, intermediate);
          Container.set(SERVICE, replacement);
          Container.remove(ALIAS);
          expect(disposed).toEqual(["intermediate"]);
          if (outcome === "rollback") throw failure;
        });
        if (outcome === "rollback") {
          await expect(attempt).rejects.toBe(failure);
          expect(scope.run(() => Container.get(SERVICE))).toBe(baseline);
          expect(disposed).toEqual(["intermediate", "replacement"]);
        } else {
          await attempt;
          expect(scope.run(() => Container.get(SERVICE))).toBe(replacement);
          expect(disposed).toEqual(["intermediate", "baseline"]);
        }
      } finally {
        scope.dispose();
      }
      expect(disposed.sort()).toEqual(["baseline", "intermediate", "replacement"]);
    },
  );

  it("keeps removals local to each application snapshot and copies root removals to new scopes", () => {
    const SERVICE = new Token<object>("service");
    const original = graph("original", [
      {
        token: SERVICE,
        tokenId: "app:service",
        debugName: "service",
        scope: "singleton",
        dependencies: [],
        factory: () => ({}),
        sourceLocation: SOURCE,
      },
    ]);
    Container.installGeneratedGraph(original);
    const first = Container.createScope();
    const second = Container.createScope();
    try {
      const secondInstance = second.run(() => Container.get(SERVICE));
      first.run(() => {
        Container.remove(SERVICE);
        Container.installGeneratedGraph(graph("unrelated", []));
        expect(Container.has(SERVICE)).toBe(false);
      });
      expect(second.run(() => Container.get(SERVICE))).toBe(secondInstance);
      expect(Container.has(SERVICE)).toBe(true);

      Container.remove(SERVICE);
      const next = Container.createScope();
      try {
        next.run(() => {
          Container.installGeneratedGraph(graph("unrelated", []));
          expect(Container.has(SERVICE)).toBe(false);
        });
        expect(second.run(() => Container.get(SERVICE))).toBe(secondInstance);
      } finally {
        next.dispose();
      }
    } finally {
      first.dispose();
      second.dispose();
    }
  });
});
