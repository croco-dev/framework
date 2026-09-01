import { ClerkAuthProvider, clerkAuth } from "@croco/auth-clerk";
import { AUTH_PROVIDER_TOKEN } from "@croco/auth-core";
import type { DiagnosticsProvider } from "@croco/diagnostics-core";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  MODULE_CONTRIBUTION_KINDS,
} from "@croco/framework-module";
import {
  nodeTelemetry,
  TELEMETRY_RUNTIME_TOKEN,
  TelemetryRuntime,
} from "@croco/telemetry-sdk-node";
import { TxManager, TxManagerRegistry } from "@croco/tx-core";
import { drizzleTransaction } from "@croco/tx-drizzle";
import type { DrizzleDb } from "@croco/tx-drizzle";
import {
  createHttpAppConfig,
  HTTP_TRANSPORT_OPTIONS_TOKEN,
  httpTransport,
} from "@croco/transports-http";
import type { CrocoHttpContext, MiddlewareFunction } from "@croco/transports-http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("plugin ApplicationRuntime integration", () => {
  const runtimes: Array<ReturnType<typeof createApplicationRuntime>> = [];

  beforeEach(async () => {
    await TelemetryRuntime.reset();
  });

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
    await TelemetryRuntime.reset();
    vi.restoreAllMocks();
  });

  it("composes auth, transaction, HTTP, telemetry, and diagnostics through one module graph", async () => {
    class OrdersController {}

    const middleware: MiddlewareFunction = async (_ctx: CrocoHttpContext, next) => next();
    const execute = vi.fn().mockResolvedValue([{ value: 1 }]);
    const transaction = vi.fn(
      async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
        operation({ execute }),
    );
    const db = { transaction } as unknown as DrizzleDb;
    const globalTxRegister = vi.spyOn(TxManagerRegistry, "register");
    const runtime = createApplicationRuntime(
      defineCrocoApplication({
        name: "representative-plugin-application",
        imports: [
          clerkAuth({ secretKey: "sk_test_application_graph" }),
          drizzleTransaction({ db, diagnostics: { name: "primary-db" } }),
          httpTransport({
            controllers: [{ id: "orders", controller: OrdersController }],
            middlewares: [{ id: "request-context", middleware }],
            securityValidation: "off",
          }),
          nodeTelemetry({
            serviceName: "representative-plugin-application",
            environment: "test",
            enabled: false,
          }),
        ],
      }),
    );
    runtimes.push(runtime);

    expect(runtime.createGraphManifest()).toMatchObject({
      status: "ready",
      applicationName: "representative-plugin-application",
      plugins: [
        { packageName: "@croco/auth-clerk" },
        { packageName: "@croco/tx-drizzle" },
        { packageName: "@croco/telemetry-sdk-node" },
        { packageName: "@croco/transports-http" },
      ],
      moduleGraph: {
        status: "ready",
        modules: expect.arrayContaining([
          expect.objectContaining({ name: "auth-clerk" }),
          expect.objectContaining({ name: "@croco/tx-drizzle/transaction" }),
          expect.objectContaining({ name: "transports-http" }),
          expect.objectContaining({ name: "@croco/telemetry-sdk-node" }),
        ]),
      },
    });

    await runtime.initialize();

    expect(runtime.get(AUTH_PROVIDER_TOKEN)).toBeInstanceOf(ClerkAuthProvider);
    expect(runtime.get(TxManager)).toBeInstanceOf(TxManager);
    expect(runtime.get(HTTP_TRANSPORT_OPTIONS_TOKEN)).toMatchObject({
      securityValidation: "off",
    });
    expect(runtime.get(TELEMETRY_RUNTIME_TOKEN)).toBe(TelemetryRuntime.getInstance());
    expect(globalTxRegister).not.toHaveBeenCalled();

    const diagnostics = runtime.getContributions<DiagnosticsProvider>(
      MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
    );
    expect(diagnostics.map((contribution) => contribution.id)).toEqual([
      "@croco/auth-clerk",
      "@croco/telemetry-sdk-node/telemetry",
      "@croco/tx-drizzle/database",
    ]);
    expect(createHttpAppConfig(runtime)).toMatchObject({
      controllers: [OrdersController],
      middlewares: [middleware],
      diagnostics: { providers: diagnostics.map((contribution) => contribution.value) },
    });

    await expect(runtime.get(TxManager).run(async () => "committed")).resolves.toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(1);

    await runtime.dispose();
    expect(TelemetryRuntime.getInstance().getConfig()).toBeNull();
  });
});
