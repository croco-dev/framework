// croco-test-clock: controlled
import { setImmediate as nextTurn } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { CircuitState, InMemoryCircuitBreakerStateStore } from "../libs/CircuitBreakerState";

function createGate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("InMemoryCircuitBreakerStateStore", () => {
  const fixedNow = () => 10_000;

  describe("상태 관리", () => {
    it("기본 상태는 CLOSED여야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      const state = await store.getState("circuit-1");
      expect(state).toBe(CircuitState.CLOSED);
    });

    it("상태를 설정하고 조회할 수 있어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      await store.setState("circuit-1", CircuitState.OPEN);
      const state = await store.getState("circuit-1");
      expect(state).toBe(CircuitState.OPEN);
    });

    it("다른 회로의 상태는 독립적이어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      await store.setState("circuit-1", CircuitState.OPEN);
      await store.setState("circuit-2", CircuitState.HALF_OPEN);

      expect(await store.getState("circuit-1")).toBe(CircuitState.OPEN);
      expect(await store.getState("circuit-2")).toBe(CircuitState.HALF_OPEN);
    });
  });

  describe("실패 카운트 관리", () => {
    it("기본 실패 카운트는 0이어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      const count = await store.getFailureCount("circuit-1");
      expect(count).toBe(0);
    });

    it("실패 카운트를 증가시킬 수 있어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      const count1 = await store.incrementFailureCount("circuit-1");
      expect(count1).toBe(1);

      const count2 = await store.incrementFailureCount("circuit-1");
      expect(count2).toBe(2);
    });

    it("실패 카운트를 초기화할 수 있어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      await store.incrementFailureCount("circuit-1");
      await store.incrementFailureCount("circuit-1");
      await store.resetFailureCount("circuit-1");

      const count = await store.getFailureCount("circuit-1");
      expect(count).toBe(0);
    });

    it("다른 회로의 실패 카운트는 독립적이어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      await store.incrementFailureCount("circuit-1");
      await store.incrementFailureCount("circuit-1");
      await store.incrementFailureCount("circuit-2");

      expect(await store.getFailureCount("circuit-1")).toBe(2);
      expect(await store.getFailureCount("circuit-2")).toBe(1);
    });
  });

  describe("마지막 실패 시간 관리", () => {
    it("기본 마지막 실패 시간은 null이어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      const time = await store.getLastFailureTime("circuit-1");
      expect(time).toBeNull();
    });

    it("마지막 실패 시간을 설정하고 조회할 수 있어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      const now = fixedNow();
      await store.setLastFailureTime("circuit-1", now);

      const time = await store.getLastFailureTime("circuit-1");
      expect(time).toBe(now);
    });

    it("다른 회로의 마지막 실패 시간은 독립적이어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      const now = fixedNow();
      await store.setLastFailureTime("circuit-1", now - 1000);
      await store.setLastFailureTime("circuit-2", now);

      expect(await store.getLastFailureTime("circuit-1")).toBe(now - 1000);
      expect(await store.getLastFailureTime("circuit-2")).toBe(now);
    });
  });

  describe("reset", () => {
    it.each([
      { method: "reset", rejectOwner: false },
      { method: "resetAll", rejectOwner: false },
      { method: "reset", rejectOwner: true },
      { method: "resetAll", rejectOwner: true },
    ] as const)(
      "$method preserves queued locks when rejectOwner=$rejectOwner",
      async ({ method, rejectOwner }) => {
        let now = 0;
        const store = new InMemoryCircuitBreakerStateStore({
          now: () => now,
          maxEntries: 1,
          idleTtlMs: 5,
        });
        const entered: string[] = [];
        const firstEntered = createGate();
        const releaseFirst = createGate();
        const secondEntered = createGate();
        const releaseSecond = createGate();
        const failure = new Error("owner failed");
        await store.setState("shared", CircuitState.HALF_OPEN);
        await store.incrementFailureCount("shared");
        await store.setLastFailureTime("shared", 123);
        await store.setHalfOpenActiveCount("shared", 2);
        await store.setHalfOpenSuccessCount("shared", 3);

        const first = store.withCircuitLock("shared", async () => {
          entered.push("first");
          firstEntered.release();
          await releaseFirst.promise;
          if (rejectOwner) throw failure;
          return "first result";
        });
        const firstOutcome = first.then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
        await firstEntered.promise;
        const second = store.withCircuitLock("shared", async () => {
          entered.push("second");
          secondEntered.release();
          await releaseSecond.promise;
          return "second result";
        });
        let third: Promise<number> | undefined;

        try {
          await store[method]("shared");
          expect(await store.getState("shared")).toBe(CircuitState.CLOSED);
          expect(await store.getFailureCount("shared")).toBe(0);
          expect(await store.getLastFailureTime("shared")).toBeNull();
          expect(await store.getHalfOpenActiveCount("shared")).toBe(0);
          expect(await store.getHalfOpenSuccessCount("shared")).toBe(0);

          third = store.withCircuitLock("shared", async () => {
            entered.push("third");
            return store.incrementFailureCount("shared");
          });
          now = 6;
          await expect(store.withCircuitLock("independent", async () => "parallel")).resolves.toBe(
            "parallel",
          );
          await nextTurn();
          expect(entered).toEqual(["first"]);

          releaseFirst.release();
          expect(await firstOutcome).toEqual(
            rejectOwner ? { error: failure } : { value: "first result" },
          );
          await secondEntered.promise;
          await nextTurn();
          expect(entered).toEqual(["first", "second"]);

          releaseSecond.release();
          await expect(second).resolves.toBe("second result");
          await expect(third).resolves.toBe(1);
          expect(entered).toEqual(["first", "second", "third"]);

          now = 12;
          expect(await store.getFailureCount("shared")).toBe(0);
          await store.incrementFailureCount("shared");
          await store.incrementFailureCount("replacement");
          expect(await store.getFailureCount("shared")).toBe(0);
          expect(await store.getFailureCount("replacement")).toBe(1);
        } finally {
          releaseFirst.release();
          releaseSecond.release();
          await Promise.allSettled([first, second, third]);
        }
      },
    );

    it.each(["reset", "resetAll"] as const)(
      "%s inside a lock does not deadlock or admit another owner",
      async (method) => {
        const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
        const resetFinished = createGate();
        const releaseOwner = createGate();
        const entered: string[] = [];
        const owner = store.withCircuitLock("shared", async () => {
          await store[method]("shared");
          entered.push("owner");
          resetFinished.release();
          await releaseOwner.promise;
        });
        let waiter: Promise<void> | undefined;
        try {
          await resetFinished.promise;
          waiter = store.withCircuitLock("shared", async () => {
            entered.push("waiter");
          });
          await nextTurn();
          expect(entered).toEqual(["owner"]);
        } finally {
          releaseOwner.release();
          await Promise.allSettled([owner, waiter]);
        }
        expect(entered).toEqual(["owner", "waiter"]);
      },
    );

    it("특정 회로의 상태를 초기화할 수 있어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      await store.setState("circuit-1", CircuitState.OPEN);
      await store.incrementFailureCount("circuit-1");
      await store.setLastFailureTime("circuit-1", fixedNow());

      await store.reset("circuit-1");

      expect(await store.getState("circuit-1")).toBe(CircuitState.CLOSED);
      expect(await store.getFailureCount("circuit-1")).toBe(0);
      expect(await store.getLastFailureTime("circuit-1")).toBeNull();
    });

    it("다른 회로의 상태는 영향받지 않아야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      await store.setState("circuit-1", CircuitState.OPEN);
      await store.setState("circuit-2", CircuitState.HALF_OPEN);

      await store.reset("circuit-1");

      expect(await store.getState("circuit-1")).toBe(CircuitState.CLOSED);
      expect(await store.getState("circuit-2")).toBe(CircuitState.HALF_OPEN);
    });

    it("모든 회로의 상태를 초기화할 수 있어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({ now: fixedNow });
      await store.setState("circuit-1", CircuitState.OPEN);
      await store.setState("circuit-2", CircuitState.HALF_OPEN);
      await store.incrementFailureCount("circuit-1");
      await store.incrementFailureCount("circuit-2");

      await store.resetAll();

      expect(await store.getState("circuit-1")).toBe(CircuitState.CLOSED);
      expect(await store.getState("circuit-2")).toBe(CircuitState.CLOSED);
      expect(await store.getFailureCount("circuit-1")).toBe(0);
      expect(await store.getFailureCount("circuit-2")).toBe(0);
    });
  });

  describe("메모리 경계 관리", () => {
    it("uses the injected clock to expire idle CLOSED state while retaining OPEN and HALF_OPEN", async () => {
      let time = 0;
      const store = new InMemoryCircuitBreakerStateStore({ idleTtlMs: 5, now: () => time });
      await store.incrementFailureCount("closed");
      await store.setState("open", CircuitState.OPEN);
      await store.setState("half-open", CircuitState.HALF_OPEN);

      time = 6;
      expect(await store.getFailureCount("closed")).toBe(0);
      expect(await store.getState("open")).toBe(CircuitState.OPEN);
      expect(await store.getState("half-open")).toBe(CircuitState.HALF_OPEN);
    });

    it("maxEntries 압박에서는 OPEN과 HALF_OPEN을 보존하고 CLOSED 회로만 제거해야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({
        now: fixedNow,
        maxEntries: 2,
        idleTtlMs: 60_000,
      });

      await store.setState("open-circuit", CircuitState.OPEN);
      await store.setState("half-open-circuit", CircuitState.HALF_OPEN);
      await store.setState("closed-circuit-1", CircuitState.CLOSED);
      await store.incrementFailureCount("closed-circuit-1");
      await store.setState("closed-circuit-2", CircuitState.CLOSED);

      expect(await store.getState("open-circuit")).toBe(CircuitState.OPEN);
      expect(await store.getState("half-open-circuit")).toBe(CircuitState.HALF_OPEN);
      expect(await store.getFailureCount("closed-circuit-1")).toBe(0);
      expect(await store.getState("closed-circuit-2")).toBe(CircuitState.CLOSED);
    });

    it("idle TTL이 지나도 OPEN과 HALF_OPEN을 보존하고 CLOSED 회로만 정리해야 한다", async () => {
      let now = 0;
      const store = new InMemoryCircuitBreakerStateStore({
        now: () => now,
        maxEntries: 10,
        idleTtlMs: 5,
      });

      await store.setState("open-circuit", CircuitState.OPEN);
      await store.setState("half-open-circuit", CircuitState.HALF_OPEN);
      await store.setState("closed-circuit", CircuitState.CLOSED);
      await store.incrementFailureCount("closed-circuit");
      await store.setLastFailureTime("closed-circuit", now);

      now = 6;

      expect(await store.getState("fresh-circuit")).toBe(CircuitState.CLOSED);
      expect(await store.getState("open-circuit")).toBe(CircuitState.OPEN);
      expect(await store.getState("half-open-circuit")).toBe(CircuitState.HALF_OPEN);
      expect(await store.getFailureCount("closed-circuit")).toBe(0);
      expect(await store.getLastFailureTime("closed-circuit")).toBeNull();
    });

    it("lock이 잡힌 회로는 eviction 대상에서 건너뛰어야 한다", async () => {
      const store = new InMemoryCircuitBreakerStateStore({
        now: fixedNow,
        maxEntries: 1,
        idleTtlMs: 60_000,
      });

      let releaseLock!: () => void;
      const pendingOperation = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });

      let acquired!: () => void;
      const lockAcquired = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const lockPromise = store.withCircuitLock("locked-circuit", async () => {
        acquired();
        await pendingOperation;
      });

      await lockAcquired;

      await store.setState("new-circuit", CircuitState.OPEN);

      expect(await store.getState("locked-circuit")).toBe(CircuitState.CLOSED);
      expect(await store.getState("new-circuit")).toBe(CircuitState.OPEN);

      releaseLock();
      await lockPromise;
    });
  });
});
