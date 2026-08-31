import { Container as TypeDIContainer, Token } from "typedi";
import type { ServiceMetadata } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { Component, Container, InjectMany } from "../index";

describe("ContainerScope", () => {
  beforeEach(() => {
    Container.reset();
    TypeDIContainer.reset();
  });

  it("resolves provider adapters registered directly in the local TypeDI container", () => {
    const token = new Token<string>("adapter-value");
    const scope = Container.createScope();

    scope.run(() => {
      TypeDIContainer.of(scope.id).set(token, "scoped");
      expect(Container.has(token)).toBe(true);
      expect(Container.get(token)).toBe("scoped");
    });

    expect(Container.has(token)).toBe(false);
    scope.dispose();
  });

  it("keeps InjectMany graph and runtime resolution isolated to the owning scope", () => {
    const token = new Token<string>("scoped-handlers");
    class HandlerCollection {
      constructor(@InjectMany(token) readonly values: readonly string[]) {}
    }
    const firstScope = Container.createScope();
    const secondScope = Container.createScope();

    TypeDIContainer.set({ id: token, value: "global", multiple: true });

    const resolveInScope = (scope: typeof firstScope, values: readonly string[]) =>
      scope.run(() => {
        const container = TypeDIContainer.of(scope.id);
        for (const value of values) {
          container.set({ id: token, value, multiple: true });
        }
        Component({ scope: "transient" })(HandlerCollection);

        const manifest = Container.createDependencyGraphManifest({ roots: [HandlerCollection] });
        const provider = manifest.providers.find((entry) => entry.token === "HandlerCollection");

        expect(manifest.status).toBe("ready");
        expect(provider?.dependencies).toEqual(["Token<scoped-handlers>"]);
        return Container.get(HandlerCollection).values;
      });

    expect(resolveInScope(firstScope, ["first-a", "first-b"])).toEqual(["first-a", "first-b"]);
    expect(resolveInScope(secondScope, ["second-a", "second-b"])).toEqual(["second-a", "second-b"]);
    expect(TypeDIContainer.getMany(token)).toEqual(["global"]);

    firstScope.dispose();
    secondScope.dispose();
  });

  it("restores the exact pre-attempt provider and component baseline after failure", async () => {
    const baselineToken = new Token<object>("baseline");
    const attemptToken = new Token<string>("attempt");
    const baseline = {};
    class AttemptComponent {}
    const scope = Container.createScope();

    scope.run(() => Container.set(baselineToken, baseline));

    await expect(
      scope.runWithRollback(async () => {
        Container.set(baselineToken, {});
        Container.set(attemptToken, "attempt");
        Component()(AttemptComponent);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    scope.run(() => {
      expect(Container.get(baselineToken)).toBe(baseline);
      expect(Container.has(attemptToken)).toBe(false);
      expect(Container.getComponentMetadata(AttemptComponent)).toBeUndefined();
    });
    scope.dispose();
  });

  it("restores metadata and reports cleanup failures when provider destruction fails", async () => {
    const attemptToken = new Token<object>("attempt-with-failing-cleanup");
    const scope = Container.createScope();
    const container = TypeDIContainer.of(scope.id) as unknown as {
      destroyServiceInstance: (service: ServiceMetadata<unknown>) => void;
    };
    const destroyServiceInstance = container.destroyServiceInstance.bind(container);
    let failCleanup = true;
    container.destroyServiceInstance = (service) => {
      if (service.id === attemptToken && failCleanup) {
        failCleanup = false;
        throw new Error("provider cleanup failed");
      }
      destroyServiceInstance(service);
    };

    await expect(
      scope.runWithRollback(async () => {
        Container.set(attemptToken, {});
        throw new Error("bootstrap failed");
      }),
    ).rejects.toMatchObject({
      code: "framework-context/container-scope-rollback-failed",
      extensions: {
        cleanupFailures: [expect.objectContaining({ message: "provider cleanup failed" })],
      },
    });

    expect(scope.run(() => Container.has(attemptToken))).toBe(false);
    scope.dispose();
  });

  it("continues disposing providers after an earlier provider cleanup fails", () => {
    const firstToken = new Token<object>("first-disposal");
    const secondToken = new Token<object>("second-disposal");
    const scope = Container.createScope();
    const container = TypeDIContainer.of(scope.id) as unknown as {
      destroyServiceInstance: (service: ServiceMetadata<unknown>) => void;
    };
    const destroyServiceInstance = container.destroyServiceInstance.bind(container);
    const destroyed: unknown[] = [];
    container.destroyServiceInstance = (service) => {
      destroyed.push(service.id);
      if (service.id === firstToken) {
        throw new Error("first provider cleanup failed");
      }
      destroyServiceInstance(service);
    };

    scope.run(() => {
      Container.set(firstToken, {});
      Container.set(secondToken, {});
    });

    expect(() => scope.dispose()).toThrow(
      expect.objectContaining({
        code: "framework-context/container-scope-disposal-failed",
        extensions: {
          cleanupFailures: [expect.objectContaining({ message: "first provider cleanup failed" })],
        },
      }),
    );
    expect(destroyed).toEqual([firstToken, secondToken]);
    expect(
      (
        TypeDIContainer as unknown as {
          instances: Array<{ id: string }>;
        }
      ).instances.some((instance) => instance.id === scope.id),
    ).toBe(false);
  });

  it("commits successful attempts", async () => {
    const token = new Token<string>("committed");
    const scope = Container.createScope();

    await scope.runWithRollback(async () => {
      await Promise.resolve();
      Container.set(token, "value");
    });

    expect(scope.run(() => Container.get(token))).toBe("value");
    scope.dispose();
  });

  it("serializes overlapping rollback attempts without retaining failed state", async () => {
    const firstToken = new Token<string>("first-attempt");
    const secondToken = new Token<string>("second-attempt");
    let enterFirst: (() => void) | undefined;
    let releaseFirst: (() => void) | undefined;
    const firstEntered = new Promise<void>((resolve) => {
      enterFirst = resolve;
    });
    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const scope = Container.createScope();

    const first = scope.runWithRollback(async () => {
      Container.set(firstToken, "first");
      enterFirst?.();
      await firstReleased;
      throw new Error("first rollback");
    });
    await firstEntered;
    const second = scope.runWithRollback(async () => {
      Container.set(secondToken, "second");
      throw new Error("second rollback");
    });

    releaseFirst?.();
    await expect(first).rejects.toThrow("first rollback");
    await expect(second).rejects.toThrow("second rollback");
    scope.run(() => {
      expect(Container.has(firstToken)).toBe(false);
      expect(Container.has(secondToken)).toBe(false);
    });
    scope.dispose();
  });

  it("joins nested rollback work to the owning transaction", async () => {
    const token = new Token<string>("nested-attempt");
    const scope = Container.createScope();

    await expect(
      scope.runWithRollback(async () => {
        await scope.runWithRollback(async () => {
          Container.set(token, "nested");
        });
        throw new Error("outer rollback");
      }),
    ).rejects.toThrow("outer rollback");

    expect(scope.run(() => Container.has(token))).toBe(false);
    scope.dispose();
  });

  it("starts a new rollback transaction for detached nested work after commit", async () => {
    const token = new Token<string>("detached-attempt");
    let completeDetached: (() => void) | undefined;
    const detachedCompleted = new Promise<void>((resolve) => {
      completeDetached = resolve;
    });
    const scope = Container.createScope();

    await scope.runWithRollback(async () => {
      setTimeout(() => {
        void scope
          .runWithRollback(async () => {
            Container.set(token, "detached");
            throw new Error("detached rollback");
          })
          .then(completeDetached, completeDetached);
      }, 0);
    });
    await detachedCompleted;

    expect(scope.run(() => Container.has(token))).toBe(false);
    scope.dispose();
  });

  it("rejects disposal while a successful rollback-protected transaction is active", async () => {
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const scope = Container.createScope();

    const transaction = scope.runWithRollback(async () => {
      entered();
      await blocked;
    });
    await started;

    expect(() => scope.dispose()).toThrow(
      expect.objectContaining({ code: "framework-context/container-scope-transaction-active" }),
    );

    release();
    await transaction;
    scope.dispose();
  });

  it("rejects disposal while a failing rollback-protected transaction is active", async () => {
    const token = new Token<string>("active-rollback");
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const scope = Container.createScope();

    const transaction = scope.runWithRollback(async () => {
      Container.set(token, "temporary");
      entered();
      await blocked;
      throw new Error("rollback");
    });
    await started;

    expect(() => scope.dispose()).toThrow(
      expect.objectContaining({ code: "framework-context/container-scope-transaction-active" }),
    );

    release();
    await expect(transaction).rejects.toThrow("rollback");
    expect(scope.run(() => Container.has(token))).toBe(false);
    scope.dispose();
  });
});
