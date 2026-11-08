import { afterEach, describe, expect, it } from "vitest";
import {
  Container,
  Context,
  GENERATED_DI_GRAPH_VERSION,
  Token,
  defineGeneratedDiGraph,
} from "../index";
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
    it("cleans a later instance once when an earlier destructor ends its request owner", () => {
      const MULTI = new Token<object>("request-reentrant-multi");
      const TRANSIENT = new Token<object>("request-reentrant-transient");
      const disposed: string[] = [];
      let request: ReturnType<typeof Context.createRequestScope> | undefined;
      const second = { destroy: () => disposed.push("second") };
      const first = {
        destroy: () => {
          disposed.push("first");
          request?.dispose();
        },
      };
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(
          graph("request-reentrant", [
            { ...singleton(MULTI, "app:multi", () => first), multiple: true },
            { ...singleton(MULTI, "app:multi", () => second), multiple: true },
            { ...singleton(TRANSIENT, "app:transient", () => second), scope: "transient" },
          ]),
        );
        request = Context.createRequestScope({ requestId: "reentrant" });
        request.run(() => expect(Container.get(TRANSIENT)).toBe(second));
        expect(Container.getMany(MULTI)).toEqual([first, second]);
        Container.remove(MULTI);
        expect(disposed).toEqual(["first", "second"]);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        request?.dispose();
        scope?.dispose();
      }
      expect(disposed).toEqual(["first", "second"]);
    });

    it("keeps replacement graph bindings when retiring the old singleton fails", () => {
      const SERVICE = new Token<object>("graph-replacement");
      const failure = new Error("old singleton closed");
      let disposed = 0;
      const previous = {
        destroy: () => {
          disposed += 1;
          throw failure;
        },
      };
      const replacement = {};
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(
          graph("replace", [singleton(SERVICE, "app:replace", () => previous)]),
        );
        expect(Container.get(SERVICE)).toBe(previous);
        expect(() =>
          Container.installGeneratedGraph(
            graph("replace", [singleton(SERVICE, "app:replace", () => replacement)]),
          ),
        ).toThrow(
          expect.objectContaining({ code: "framework-context/container-provider-cleanup-failed" }),
        );
        expect(Container.get(SERVICE)).toBe(replacement);
        expect(disposed).toBe(1);
        Container.remove(SERVICE);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        scope?.dispose();
      }
      expect(disposed).toBe(1);
    });

    it("retains an instance registered by an earlier destructor in the same removal", () => {
      const MULTI = new Token<object>("reentrant-multi");
      const KEEP = new Token<object>("reentrant-keep");
      const disposed: string[] = [];
      const second = { destroy: () => disposed.push("second") };
      const first = {
        destroy: () => {
          disposed.push("first");
          Container.set(KEEP, second);
        },
      };
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(
          graph("reentrant", [
            { ...singleton(MULTI, "app:multi", () => first), multiple: true },
            { ...singleton(MULTI, "app:multi", () => second), multiple: true },
          ]),
        );
        expect(Container.getMany(MULTI)).toEqual([first, second]);
        Container.remove(MULTI);
        expect(disposed).toEqual(["first"]);
        expect(Container.get(KEEP)).toBe(second);
        Container.remove(KEEP);
        expect(disposed).toEqual(["first", "second"]);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        scope?.dispose();
      }
    });

    it.each(["request first", "singleton first"] as const)(
      "releases a shared request transient after %s",
      (order) => {
        const SERVICE = new Token<object>("request-shared-singleton");
        const TRANSIENT = new Token<object>("request-shared-transient");
        let disposed = 0;
        const shared = {
          destroy: () => {
            disposed += 1;
          },
        };
        const scope = target === "application" ? Container.createScope() : undefined;
        const run = () => {
          Container.installGeneratedGraph(
            graph("request-sharing", [
              singleton(SERVICE, "app:singleton", () => shared),
              { ...singleton(TRANSIENT, "app:transient", () => shared), scope: "transient" },
            ]),
          );
          expect(Container.get(SERVICE)).toBe(shared);
          Context.run({ requestId: "shared-owner" }, () => {
            expect(Container.get(TRANSIENT)).toBe(shared);
            if (order === "singleton first") Container.remove(SERVICE);
            expect(disposed).toBe(0);
          });
          if (order === "request first") {
            expect(disposed).toBe(0);
            Container.remove(SERVICE);
          }
          expect(disposed).toBe(1);
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

    it("retains shared values until all independently owned requests end", () => {
      const SERVICE = new Token<object>("concurrent-singleton");
      const TRANSIENT = new Token<object>("concurrent-transient");
      let disposed = 0;
      const shared = {
        destroy: () => {
          disposed += 1;
        },
      };
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(
          graph("requests", [
            singleton(SERVICE, "app:singleton", () => shared),
            { ...singleton(TRANSIENT, "app:transient", () => shared), scope: "transient" },
          ]),
        );
        Container.get(SERVICE);
        const first = Context.createRequestScope({ requestId: "first" });
        const second = Context.createRequestScope({ requestId: "second" });
        try {
          first.run(() => {
            Container.get(TRANSIENT);
            Container.get(TRANSIENT);
          });
          second.run(() => Container.get(TRANSIENT));
          Container.remove(SERVICE);
          expect(disposed).toBe(0);
          first.dispose();
          expect(disposed).toBe(0);
          second.dispose();
          expect(disposed).toBe(1);
        } finally {
          first.dispose();
          second.dispose();
        }
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        scope?.dispose();
      }
      expect(disposed).toBe(1);
    });

    it("retains a shared transient outside a request until the container lifetime ends", () => {
      const SERVICE = new Token<object>("lifetime-singleton");
      const TRANSIENT = new Token<object>("lifetime-transient");
      let disposed = 0;
      const shared = {
        destroy: () => {
          disposed += 1;
        },
      };
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(
          graph("lifetime-sharing", [
            singleton(SERVICE, "app:singleton", () => shared),
            { ...singleton(TRANSIENT, "app:transient", () => shared), scope: "transient" },
          ]),
        );
        Container.get(SERVICE);
        Container.get(TRANSIENT);
        Container.remove(SERVICE);
        expect(disposed).toBe(0);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        if (scope) scope.dispose();
        else Container.reset();
      }
      expect(disposed).toBe(1);
    });

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

  it.each([
    ["commit", "direct"],
    ["rollback", "direct"],
    ["commit", "request handle"],
    ["rollback", "request handle"],
  ] as const)(
    "retains a replaced runtime baseline until transaction %s through %s",
    async (outcome, caller) => {
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
      const request = scope.run(() => {
        Container.set(SERVICE, baseline);
        return Context.createRequestScope({ requestId: "baseline-replacement" });
      });
      try {
        const attempt = scope.runWithRollback(async () => {
          if (caller === "request handle") request.run(() => Container.set(SERVICE, replacement));
          else Container.set(SERVICE, replacement);
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
        request.dispose();
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

  it.each([
    ["commit", "inline"],
    ["rollback", "inline"],
    ["commit", "detached"],
    ["rollback", "detached"],
  ] as const)(
    "does not repeat request-owned intermediate cleanup before %s with an %s request",
    async (outcome, requestKind) => {
      const scope = Container.createScope();
      const SERVICE = new Token<object>("request-replacement-owner");
      const TRANSIENT = new Token<object>("request-replacement-transient");
      const disposed: string[] = [];
      const baseline = { destroy: () => disposed.push("baseline") };
      const intermediate = { destroy: () => disposed.push("intermediate") };
      const replacement = { destroy: () => disposed.push("replacement") };
      const failure = new Error("rollback after request cleanup");
      const request = scope.run(() => {
        Container.set(SERVICE, baseline);
        Container.installGeneratedGraph(
          graph("request-replacements", [
            { ...singleton(TRANSIENT, "app:transient", () => intermediate), scope: "transient" },
          ]),
        );
        return Context.createRequestScope({ requestId: "detached-replacement" });
      });
      try {
        const attempt = scope.runWithRollback(async () => {
          if (requestKind === "inline") {
            Context.run({ requestId: "replacement" }, () => {
              expect(Container.get(TRANSIENT)).toBe(intermediate);
              Container.set(SERVICE, intermediate);
              Container.set(SERVICE, replacement);
            });
          } else {
            request.run(() => expect(Container.get(TRANSIENT)).toBe(intermediate));
            Container.set(SERVICE, intermediate);
            Container.set(SERVICE, replacement);
            request.dispose();
          }
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
        request.dispose();
        scope.dispose();
      }
      expect(disposed.sort()).toEqual(["baseline", "intermediate", "replacement"]);
    },
  );

  it.each(["inline", "detached"] as const)(
    "preserves a request-shared baseline for an %s request",
    async (requestKind) => {
      for (const outcome of ["commit", "rollback"] as const) {
        const scope = Container.createScope();
        const SERVICE = new Token<object>("request-baseline-owner");
        const TRANSIENT = new Token<object>("request-baseline-transient");
        const disposed: string[] = [];
        const baseline = { destroy: () => disposed.push("baseline") };
        const replacement = { destroy: () => disposed.push("replacement") };
        const failure = new Error("rollback shared baseline");
        const request = scope.run(() => {
          Container.set(SERVICE, baseline);
          Container.installGeneratedGraph(
            graph("baseline-requests", [
              { ...singleton(TRANSIENT, "app:transient", () => baseline), scope: "transient" },
            ]),
          );
          return Context.createRequestScope({ requestId: "baseline" });
        });
        try {
          const attempt = scope.runWithRollback(async () => {
            if (requestKind === "inline") {
              Context.run({ requestId: "inline-baseline" }, () => {
                expect(Container.get(TRANSIENT)).toBe(baseline);
                Container.set(SERVICE, replacement);
              });
            } else {
              request.run(() => expect(Container.get(TRANSIENT)).toBe(baseline));
              Container.set(SERVICE, replacement);
              request.dispose();
            }
            expect(disposed).toEqual([]);
            if (outcome === "rollback") throw failure;
          });
          if (outcome === "rollback") {
            await expect(attempt).rejects.toBe(failure);
            expect(scope.run(() => Container.get(SERVICE))).toBe(baseline);
            expect(disposed).toEqual(["replacement"]);
          } else {
            await attempt;
            expect(scope.run(() => Container.get(SERVICE))).toBe(replacement);
            expect(disposed).toEqual(["baseline"]);
          }
        } finally {
          request.dispose();
          scope.dispose();
        }
        expect(disposed.sort()).toEqual(["baseline", "replacement"]);
      }
    },
  );

  it.each(["runtime", "singleton", "transient"] as const)(
    "retains an active request owner through rollback of a %s binding",
    async (kind) => {
      const scope = Container.createScope();
      const SERVICE = new Token<object>("rollback-request-owner");
      const GENERATED = new Token<object>("rollback-generated-owner");
      const TRANSIENT = new Token<object>("rollback-request-transient");
      const disposed: string[] = [];
      const baseline = { destroy: () => disposed.push("baseline") };
      const shared = { destroy: () => disposed.push("shared") };
      const failure = new Error("rollback before request release");
      const request = scope.run(() => {
        Container.set(SERVICE, baseline);
        Container.installGeneratedGraph(
          graph("active-request", [
            { ...singleton(TRANSIENT, "app:transient", () => shared), scope: "transient" },
          ]),
        );
        return Context.createRequestScope({ requestId: "active-rollback" });
      });
      try {
        await expect(
          scope.runWithRollback(async () => {
            if (kind === "runtime") Container.set(SERVICE, shared);
            else {
              Container.installGeneratedGraph(
                graph("temporary-owner", [
                  { ...singleton(GENERATED, "app:temporary", () => shared), scope: kind },
                ]),
              );
              expect(Container.get(GENERATED)).toBe(shared);
            }
            request.run(() => expect(Container.get(TRANSIENT)).toBe(shared));
            throw failure;
          }),
        ).rejects.toBe(failure);
        expect(scope.run(() => Container.get(SERVICE))).toBe(baseline);
        expect(scope.run(() => Container.has(GENERATED))).toBe(false);
        expect(disposed).toEqual([]);
        request.dispose();
        expect(disposed).toEqual(["shared"]);
      } finally {
        request.dispose();
        scope.dispose();
      }
      expect(disposed).toEqual(["shared", "baseline"]);
    },
  );

  it("releases an explicitly removed baseline when its last request ends before commit", async () => {
    const scope = Container.createScope();
    const SERVICE = new Token<object>("explicit-baseline");
    const TRANSIENT = new Token<object>("explicit-baseline-transient");
    let disposed = 0;
    const baseline = {
      destroy: () => {
        disposed += 1;
      },
    };
    scope.run(() => {
      Container.set(SERVICE, baseline);
      Container.installGeneratedGraph(
        graph("explicit-request", [
          { ...singleton(TRANSIENT, "app:transient", () => baseline), scope: "transient" },
        ]),
      );
    });
    try {
      await scope.runWithRollback(async () => {
        Context.run({ requestId: "explicit" }, () => {
          Container.get(TRANSIENT);
          Container.remove(SERVICE);
          expect(disposed).toBe(0);
        });
        expect(disposed).toBe(1);
      });
      expect(scope.run(() => Container.has(SERVICE))).toBe(false);
    } finally {
      scope.dispose();
    }
    expect(disposed).toBe(1);
  });

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
