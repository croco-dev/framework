import { Container as TypeDIContainer, Token } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { Component, Container } from "../index";

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
});
