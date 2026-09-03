import { BILLING_GATEWAY_TOKEN } from "@croco/billing-core";
import type { DiagnosticsProvider } from "@croco/diagnostics-core";
import type { ILogger } from "@croco/framework-context";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  MODULE_CONTRIBUTION_KINDS,
} from "@croco/framework-module";
import { describe, expect, it, vi } from "vitest";
import {
  POLAR_BILLING_MODULE_NAME,
  PolarBillingDiagnosticsProvider,
  PolarBillingGateway,
  polarBilling,
} from "../index";

function createLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

describe("polarBilling", () => {
  it("owns the billing gateway slot and contributes safe diagnostics", async () => {
    const plugin = polarBilling({
      accessToken: "polar-secret-token",
      environment: "sandbox",
      webhookSecret: "polar-webhook-secret",
      logger: createLogger(),
    });
    const runtime = createApplicationRuntime(
      defineCrocoApplication({ name: "polar-test", imports: [plugin] }),
    );

    await runtime.initialize();

    expect(runtime.get(BILLING_GATEWAY_TOKEN)).toBeInstanceOf(PolarBillingGateway);
    expect(
      runtime.getContributions<DiagnosticsProvider>(MODULE_CONTRIBUTION_KINDS.diagnosticsProvider),
    ).toEqual([
      {
        id: "@croco/billing-polar",
        kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
        moduleName: POLAR_BILLING_MODULE_NAME,
        order: 100,
        value: expect.any(PolarBillingDiagnosticsProvider),
      },
    ]);
    expect(runtime.createGraphManifest()).toMatchObject({
      applicationName: "polar-test",
      plugins: [
        {
          name: "polar-billing",
          packageName: "@croco/billing-polar",
          maturity: "beta",
          capabilities: [
            { id: "billing.gateway", kind: "single" },
            { id: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider, kind: "multi" },
          ],
        },
      ],
      moduleGraph: {
        status: "ready",
        modules: [
          {
            name: POLAR_BILLING_MODULE_NAME,
            providers: [{ token: "BillingGateway", provider: "factory" }],
            exports: ["BillingGateway"],
          },
        ],
      },
    });
    expect(JSON.stringify(runtime.createGraphManifest())).not.toContain("polar-secret-token");
    expect(JSON.stringify(runtime.createGraphManifest())).not.toContain("polar-webhook-secret");

    await runtime.dispose();
  });

  it("publishes complete metadata without configuration values", () => {
    const plugin = polarBilling({
      accessToken: "never-serialize-access",
      environment: "production",
      webhookSecret: "never-serialize-webhook",
      organizationId: "org-test",
      logger: createLogger(),
    });

    expect(plugin.metadata).toMatchObject({
      name: "polar-billing",
      packageName: "@croco/billing-polar",
      maturity: "beta",
      runtimeCompatibility: ["node", "lambda"],
      configuration: [
        { key: "POLAR_ACCESS_TOKEN", required: true, sensitive: true },
        { key: "POLAR_WEBHOOK_SECRET", required: true, sensitive: true },
        { key: "POLAR_ENVIRONMENT", required: true },
        { key: "POLAR_ORGANIZATION_ID", required: false },
        { key: "logger", required: true },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/billing-polar test",
          reference: "packages/billing-polar/src/tests/PolarBillingPlugin.spec.ts",
        },
      ],
      examples: ["packages/billing-polar/README.md#canonical-module-plugin"],
    });
    expect(JSON.stringify(plugin.metadata)).not.toContain("never-serialize-access");
    expect(JSON.stringify(plugin.metadata)).not.toContain("never-serialize-webhook");
  });
});
