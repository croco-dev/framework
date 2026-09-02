import type { DiagnosticsProvider } from "@croco/diagnostics-core";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  defineCrocoModule,
} from "@croco/framework-module";
import type { CrocoPlugin } from "@croco/framework-module";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  nodeTelemetry,
  TELEMETRY_RUNTIME_TOKEN,
  TelemetryDiagnosticsProvider,
  TelemetryRuntime,
} from "../index";

describe("nodeTelemetry", () => {
  const applications: Array<ReturnType<typeof createApplicationRuntime>> = [];

  afterEach(async () => {
    await Promise.all(applications.splice(0).map((application) => application.dispose()));
    await TelemetryRuntime.reset();
  });

  function createDisabledApplication(serviceName = "module-owned-telemetry") {
    return createApplicationFromPlugin(
      nodeTelemetry({
        serviceName,
        environment: "test",
        enabled: false,
        diagnostics: { requirement: "required" },
      }),
    );
  }

  function createApplicationFromPlugin(plugin: CrocoPlugin) {
    const application = createApplicationRuntime(
      defineCrocoApplication({
        name: "telemetry-application",
        imports: [plugin],
      }),
    );
    applications.push(application);
    return application;
  }

  it("owns disabled telemetry initialization and cleanup through ApplicationRuntime", async () => {
    const application = createDisabledApplication();
    const telemetry = TelemetryRuntime.getInstance();

    expect(telemetry.getConfig()).toBeNull();

    await application.initialize();

    expect(application.get(TELEMETRY_RUNTIME_TOKEN)).toBe(telemetry);
    expect(telemetry.getConfig()).toEqual({
      serviceName: "module-owned-telemetry",
      environment: "test",
      enabled: false,
    });
    expect(telemetry.isInitialized()).toBe(false);

    await application.dispose();

    expect(telemetry.getConfig()).toBeNull();
  });

  it("keeps compatible telemetry active until every ApplicationRuntime owner is disposed", async () => {
    const plugin = nodeTelemetry({
      serviceName: "module-owned-telemetry",
      environment: "test",
      enabled: false,
    });
    const firstApplication = createApplicationFromPlugin(plugin);
    const secondApplication = createApplicationFromPlugin(plugin);
    const telemetry = TelemetryRuntime.getInstance();

    await firstApplication.initialize();
    await secondApplication.initialize();

    await firstApplication.dispose();

    expect(telemetry.getConfig()).toEqual({
      serviceName: "module-owned-telemetry",
      environment: "test",
      enabled: false,
    });
    expect(secondApplication.get(TELEMETRY_RUNTIME_TOKEN)).toBe(telemetry);

    await secondApplication.dispose();

    expect(telemetry.getConfig()).toBeNull();
  });

  it("keeps telemetry owned while a compatible ApplicationRuntime is initializing", async () => {
    const firstApplication = createDisabledApplication();
    const secondApplication = createDisabledApplication();
    const telemetry = TelemetryRuntime.getInstance();
    const originalInit = telemetry.init.bind(telemetry);
    let continueInitialization: () => void = () => undefined;
    let markInitializationStarted: () => void = () => undefined;
    const initializationCanContinue = new Promise<void>((resolve) => {
      continueInitialization = resolve;
    });
    const initializationStarted = new Promise<void>((resolve) => {
      markInitializationStarted = resolve;
    });

    await firstApplication.initialize();
    vi.spyOn(telemetry, "init").mockImplementationOnce(async (config) => {
      markInitializationStarted();
      await initializationCanContinue;
      await originalInit(config);
    });

    const secondInitialization = secondApplication.initialize();
    await initializationStarted;
    await firstApplication.dispose();

    expect(telemetry.getConfig()).toMatchObject({ serviceName: "module-owned-telemetry" });

    continueInitialization();
    await secondInitialization;
    await secondApplication.dispose();

    expect(telemetry.getConfig()).toBeNull();
  });

  it("does not release an active owner when a shared plugin rolls back before telemetry start", async () => {
    const plugin = nodeTelemetry({
      serviceName: "module-owned-telemetry",
      environment: "test",
      enabled: false,
    });
    const activeApplication = createApplicationFromPlugin(plugin);
    const failingApplication = createApplicationRuntime(
      defineCrocoApplication({
        name: "failing-telemetry-application",
        imports: [
          plugin,
          defineCrocoModule({
            name: "failing-setup",
            setup: () => {
              throw new Error("setup failed before telemetry start");
            },
          }),
        ],
      }),
    );
    applications.push(failingApplication);
    const telemetry = TelemetryRuntime.getInstance();

    await activeApplication.initialize();

    await expect(failingApplication.initialize()).rejects.toThrow(
      "setup failed before telemetry start",
    );
    expect(telemetry.getConfig()).toMatchObject({ serviceName: "module-owned-telemetry" });

    await activeApplication.dispose();

    expect(telemetry.getConfig()).toBeNull();
  });

  it("rejects an incompatible ApplicationRuntime without releasing the active owner", async () => {
    const firstApplication = createDisabledApplication();
    const incompatibleApplication = createDisabledApplication("incompatible-telemetry");
    const telemetry = TelemetryRuntime.getInstance();

    await firstApplication.initialize();

    await expect(incompatibleApplication.initialize()).rejects.toThrow(
      "cannot apply a different configuration",
    );
    expect(telemetry.getConfig()).toMatchObject({ serviceName: "module-owned-telemetry" });

    await firstApplication.dispose();

    expect(telemetry.getConfig()).toBeNull();
  });

  it("resolves deterministic diagnostics and graph metadata without exporter credentials", async () => {
    const application = createDisabledApplication();

    await application.initialize();

    expect(application.getContributions<DiagnosticsProvider>("diagnostics.provider")).toEqual([
      {
        id: "@croco/telemetry-sdk-node/telemetry",
        kind: "diagnostics.provider",
        moduleName: "@croco/telemetry-sdk-node",
        order: 100,
        value: expect.any(TelemetryDiagnosticsProvider),
      },
    ]);
    expect(application.createGraphManifest()).toMatchObject({
      applicationName: "telemetry-application",
      plugins: [
        {
          name: "node-telemetry",
          packageName: "@croco/telemetry-sdk-node",
          maturity: "production",
          providedContracts: [
            "@croco/telemetry-sdk-node/TelemetryRuntime",
            "@croco/diagnostics-core/DiagnosticsProvider",
          ],
          capabilities: [
            { id: "telemetry.runtime", kind: "single" },
            { id: "diagnostics.provider", kind: "multi" },
          ],
          runtimeCompatibility: ["node", "lambda"],
        },
      ],
      moduleGraph: {
        status: "ready",
        modules: [
          {
            name: "@croco/telemetry-sdk-node",
            providers: expect.arrayContaining([
              { token: "TelemetryRuntime", provider: "value" },
              {
                token: "@croco/telemetry-sdk-node/lifecycle-owner",
                provider: "factory",
              },
            ]),
            exports: ["TelemetryRuntime"],
            contributions: [
              {
                id: "@croco/telemetry-sdk-node/telemetry",
                kind: "diagnostics.provider",
                order: 100,
              },
            ],
          },
        ],
      },
    });
  });

  it("publishes complete inspectable metadata without serializing runtime configuration", () => {
    const serviceName = "metadata-must-not-capture-this";
    const plugin = nodeTelemetry({ serviceName, enabled: false });

    expect(plugin.metadata).toEqual({
      name: "node-telemetry",
      packageName: "@croco/telemetry-sdk-node",
      maturity: "production",
      providedContracts: [
        "@croco/telemetry-sdk-node/TelemetryRuntime",
        "@croco/diagnostics-core/DiagnosticsProvider",
      ],
      capabilities: [
        { id: "telemetry.runtime", kind: "single" },
        { id: "diagnostics.provider", kind: "multi" },
      ],
      runtimeCompatibility: ["node", "lambda"],
      configuration: [
        {
          key: "serviceName",
          required: true,
          description: "Service identity supplied explicitly to nodeTelemetry().",
        },
        {
          key: "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
          required: false,
          description: "Trace endpoint used when trace.exporterUrl is not supplied.",
        },
        {
          key: "OTEL_EXPORTER_OTLP_ENDPOINT",
          required: false,
          description: "Fallback OTLP endpoint used when the trace-specific endpoint is absent.",
        },
        {
          key: "TELEMETRY_ENABLED",
          required: false,
          description: "Optional process-level telemetry enablement setting.",
        },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/telemetry-sdk-node test",
          reference: "packages/telemetry-sdk-node/src/tests/NodeTelemetryPlugin.spec.ts",
        },
      ],
      examples: ["packages/telemetry-sdk-node/README.md#canonical-module-plugin"],
    });
    expect(JSON.stringify(plugin.metadata)).not.toContain(serviceName);
  });
});
