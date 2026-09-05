import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";
import { TxManager, TxManagerRegistry } from "@croco/tx-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { drizzleTransaction } from "../libs/DrizzleTransactionPlugin";
import type { DrizzleDb } from "../libs/types";

function createDb() {
  const execute = vi.fn().mockResolvedValue([{ value: 1 }]);
  const transaction = vi.fn(
    async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute }),
  );

  return {
    db: { transaction } as unknown as DrizzleDb,
    execute,
    transaction,
  };
}

describe("drizzleTransaction", () => {
  const runtimes: Array<ReturnType<typeof createApplicationRuntime>> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
    vi.restoreAllMocks();
  });

  function createRuntime(
    db: DrizzleDb,
    diagnosticsName = "primary-db",
    shutdown?: () => void | Promise<void>,
  ) {
    const runtime = createApplicationRuntime(
      defineCrocoApplication({
        name: "drizzle-application",
        imports: [
          drizzleTransaction({
            db,
            transaction: { defaultNesting: "savepoint" },
            diagnostics: { name: diagnosticsName },
            ...(shutdown === undefined ? {} : { shutdown }),
          }),
        ],
      }),
    );
    runtimes.push(runtime);
    return runtime;
  }

  it("inserts complete plugin metadata and its module into the application graph", async () => {
    const { db } = createDb();
    const runtime = createRuntime(db);

    await runtime.initialize();

    expect(runtime.createGraphManifest()).toMatchObject({
      applicationName: "drizzle-application",
      plugins: [
        {
          name: "drizzle-transaction",
          packageName: "@croco/tx-drizzle",
          maturity: "production",
          providedContracts: [
            "@croco/tx-core/TxManager",
            "@croco/diagnostics-core/DiagnosticsProvider",
          ],
          capabilities: [
            { id: "transaction.manager", kind: "single" },
            { id: "diagnostics.provider", kind: "multi" },
          ],
          runtimeCompatibility: ["node", "lambda"],
          configuration: [
            { key: "db", required: true },
            { key: "transaction", required: false },
            { key: "diagnostics.name", required: false },
            { key: "shutdown", required: false },
          ],
        },
      ],
      moduleGraph: {
        status: "ready",
        modules: [
          {
            name: "@croco/tx-drizzle/transaction",
            exports: ["TxManager"],
            contributions: [
              {
                kind: "diagnostics.provider",
                id: "@croco/tx-drizzle/database",
                order: 100,
              },
            ],
          },
        ],
      },
    });
  });

  it("resolves an application-owned TxManager from the class token", async () => {
    const { db, transaction } = createDb();
    const runtime = createRuntime(db);

    await runtime.initialize();
    const txManager = runtime.get(TxManager);

    await expect(txManager.run(async () => "committed")).resolves.toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("contributes deterministic diagnostics metadata and maps Drizzle health", async () => {
    const { db, execute } = createDb();
    const runtime = createRuntime(db);

    await runtime.initialize();
    const [contribution] = runtime.getContributions<{
      readonly name: string;
      getHealth(): Promise<unknown>;
    }>("diagnostics.provider");

    expect(contribution).toMatchObject({
      kind: "diagnostics.provider",
      id: "@croco/tx-drizzle/database",
      moduleName: "@croco/tx-drizzle/transaction",
      order: 100,
      value: { name: "primary-db.drizzle" },
    });
    await expect(contribution.value.getHealth()).resolves.toMatchObject({
      status: "healthy",
      component: "primary-db",
      lastChecked: expect.any(String),
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("maps a failed and redacted Drizzle health check to unhealthy diagnostics", async () => {
    const db = {
      transaction: vi
        .fn()
        .mockRejectedValue(new Error("postgres://admin:secret@db/app?token=private")),
    } as unknown as DrizzleDb;
    const runtime = createRuntime(db);

    await runtime.initialize();
    const [contribution] = runtime.getContributions<{
      getHealth(): Promise<unknown>;
    }>("diagnostics.provider");

    await expect(contribution.value.getHealth()).resolves.toMatchObject({
      status: "unhealthy",
      component: "primary-db",
      message: "postgres://[redacted]@db/app?token=[redacted]",
      details: { error: "postgres://[redacted]@db/app?token=[redacted]" },
    });
  });

  it("does not read or mutate the global TxManagerRegistry", async () => {
    const register = vi.spyOn(TxManagerRegistry, "register");
    const get = vi.spyOn(TxManagerRegistry, "get");
    const { db } = createDb();
    const runtime = createRuntime(db);

    await runtime.initialize();
    expect(runtime.get(TxManager)).toBeInstanceOf(TxManager);

    expect(register).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it("awaits application-owned database cleanup exactly once during disposal", async () => {
    const { db } = createDb();
    let releaseCleanup: (() => void) | undefined;
    const cleanupBarrier = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const shutdown = vi.fn(() => cleanupBarrier);
    const runtime = createRuntime(db, "primary-db", shutdown);

    await runtime.initialize();
    const firstDispose = runtime.dispose();
    const secondDispose = runtime.dispose();

    await vi.waitFor(() => expect(shutdown).toHaveBeenCalledOnce());
    let disposed = false;
    void firstDispose.then(() => {
      disposed = true;
    });
    await Promise.resolve();
    expect(disposed).toBe(false);

    releaseCleanup?.();
    await Promise.all([firstDispose, secondDispose]);
    expect(shutdown).toHaveBeenCalledOnce();
  });
});
