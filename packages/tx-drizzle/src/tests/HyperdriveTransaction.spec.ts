import { beforeEach, describe, expect, it, vi } from "vitest";

const driver = vi.hoisted(() => ({
  connect: vi.fn(),
  end: vi.fn(),
  transaction: vi.fn(),
  created: 0,
}));
vi.mock("pg", () => ({
  Client: class {
    constructor() {
      driver.created++;
    }
    on() {}
    connect = driver.connect;
    end = driver.end;
  },
}));
vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: () => ({ transaction: driver.transaction }),
}));
import { HyperdriveTransactionProblem, withHyperdriveTransaction } from "../hyperdrive";

const binding = { connectionString: "postgres://private-user:private-password@private-host/db" };

describe("request-owned Hyperdrive transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driver.created = 0;
    driver.connect.mockResolvedValue(undefined);
    driver.end.mockResolvedValue(undefined);
    driver.transaction.mockImplementation(async (operation) =>
      operation({ marker: "transaction", execute: vi.fn().mockResolvedValue(undefined) }),
    );
  });

  it("owns a fresh connection per invocation and awaits cleanup", async () => {
    let finish: (() => void) | undefined;
    driver.end.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    let settled = false;
    const first = withHyperdriveTransaction(binding, async () => 37).then((result) => {
      settled = true;
      return result;
    });
    await vi.waitFor(() => expect(finish).toBeDefined());
    expect(settled).toBe(false);
    finish?.();
    expect(await first).toBe(37);
    expect(await withHyperdriveTransaction(binding, async () => 91)).toBe(91);
    expect(driver.created).toBe(2);
    expect(driver.end).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, { connectionString: "" }])(
    "rejects a missing binding before user work",
    async (invalid) => {
      const operation = vi.fn();
      await expect(withHyperdriveTransaction(invalid, operation)).rejects.toMatchObject({
        extensions: { phase: "configuration", outcome: "not-started" },
      });
      expect(operation).not.toHaveBeenCalled();
      expect(driver.created).toBe(0);
    },
  );

  it.each([0, -1, NaN, Infinity, 1.5, 2147483648])("rejects invalid deadline %s", async (value) => {
    await expect(
      withHyperdriveTransaction(binding, async () => 1, { statementTimeoutMs: value }),
    ).rejects.toBeInstanceOf(HyperdriveTransactionProblem);
    expect(driver.created).toBe(0);
  });

  it("does not connect for an already aborted request", async () => {
    await expect(
      withHyperdriveTransaction(binding, vi.fn(), { signal: AbortSignal.abort("secret") }),
    ).rejects.toMatchObject({
      extensions: { phase: "connect", aborted: true, outcome: "not-started" },
    });
    expect(driver.created).toBe(0);
  });

  it("does not enter the transaction after abort during connect", async () => {
    const controller = new AbortController();
    driver.connect.mockImplementationOnce(async () => {
      controller.abort("secret-abort");
    });
    await expect(
      withHyperdriveTransaction(binding, vi.fn(), { signal: controller.signal }),
    ).rejects.toMatchObject({
      extensions: { phase: "connect", aborted: true, outcome: "not-started" },
    });
    expect(driver.transaction).not.toHaveBeenCalled();
    expect(driver.end).toHaveBeenCalledOnce();
  });

  it.each(["connect", "transaction"] as const)(
    "redacts %s failures and permits a new invocation",
    async (phase) => {
      driver[phase].mockRejectedValueOnce(
        new Error(`private-password SQL secret ${binding.connectionString}`),
      );
      let failure: unknown;
      try {
        await withHyperdriveTransaction(binding, async () => 8);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(HyperdriveTransactionProblem);
      expect(failure).toMatchObject({ extensions: { phase, retryable: false } });
      expect(String(failure)).not.toContain("private-");
      expect(JSON.stringify(failure)).not.toContain("secret");
      expect((failure as Error).cause).toBeUndefined();
      expect(driver.end).toHaveBeenCalledOnce();
      expect(await withHyperdriveTransaction(binding, async () => 19)).toBe(19);
      expect(driver.created).toBe(2);
    },
  );

  it("reports a committed outcome when cleanup fails after a successful transaction", async () => {
    driver.end.mockRejectedValueOnce(new Error("private-password"));
    await expect(withHyperdriveTransaction(binding, async () => 4)).rejects.toMatchObject({
      extensions: { phase: "close", outcome: "committed", cleanupFailed: true, retryable: false },
    });
  });

  it("retains the failed transaction phase when cleanup also fails", async () => {
    driver.transaction.mockRejectedValueOnce(new Error("private-query"));
    driver.end.mockRejectedValueOnce(new Error("private-password"));
    await expect(withHyperdriveTransaction(binding, async () => 4)).rejects.toMatchObject({
      extensions: { phase: "transaction", outcome: "unknown", cleanupFailed: true },
    });
  });
});
