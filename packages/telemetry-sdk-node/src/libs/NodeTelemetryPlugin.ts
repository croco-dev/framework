import type { DiagnosticsProvider } from "@croco/diagnostics-core";
import {
  defineCrocoModule,
  defineCrocoPlugin,
  MODULE_CONTRIBUTION_KINDS,
} from "@croco/framework-module";
import type { ModuleToken, PluginFactory } from "@croco/framework-module";
import type { TelemetryConfig } from "../config";
import { TelemetryRuntime } from "../runtime";
import {
  TelemetryDiagnosticsProvider,
  type TelemetryDiagnosticsProviderOptions,
} from "./diagnostics/TelemetryDiagnosticsProvider";

const NODE_TELEMETRY_MODULE_NAME = "@croco/telemetry-sdk-node";
const TELEMETRY_DIAGNOSTICS_CONTRIBUTION_ID = "@croco/telemetry-sdk-node/telemetry";
const TELEMETRY_LIFECYCLE_OWNER_TOKEN = Symbol(
  "@croco/telemetry-sdk-node/lifecycle-owner",
) as ModuleToken<NodeTelemetryLifecycleOwner>;
const activeNodeTelemetryLifecycleOwners = new Set<NodeTelemetryLifecycleOwner>();

type NodeTelemetryLifecycleOwner = object;

export const TELEMETRY_RUNTIME_TOKEN = TelemetryRuntime as unknown as ModuleToken<TelemetryRuntime>;

export type NodeTelemetryPluginOptions = TelemetryConfig & {
  readonly diagnostics?: TelemetryDiagnosticsProviderOptions;
};

export const nodeTelemetry: PluginFactory<NodeTelemetryPluginOptions> = (options) => {
  const { diagnostics, ...config } = options;
  const telemetryRuntime = TelemetryRuntime.getInstance();
  const diagnosticsProvider = new TelemetryDiagnosticsProvider(diagnostics);

  return defineCrocoPlugin({
    metadata: {
      name: "node-telemetry",
      packageName: "@croco/telemetry-sdk-node",
      maturity: "production",
      providedContracts: [
        "@croco/telemetry-sdk-node/TelemetryRuntime",
        "@croco/diagnostics-core/DiagnosticsProvider",
      ],
      capabilities: [
        { id: "telemetry.runtime", kind: "single" },
        { id: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider, kind: "multi" },
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
    },
    modules: [
      defineCrocoModule({
        name: NODE_TELEMETRY_MODULE_NAME,
        providers: [
          { provide: TELEMETRY_RUNTIME_TOKEN, useValue: telemetryRuntime },
          {
            provide: TELEMETRY_LIFECYCLE_OWNER_TOKEN,
            useFactory: () => ({}),
          },
        ],
        exports: [TELEMETRY_RUNTIME_TOKEN],
        contributions: [
          {
            kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
            id: TELEMETRY_DIAGNOSTICS_CONTRIBUTION_ID,
            order: 100,
            value: diagnosticsProvider satisfies DiagnosticsProvider,
          },
        ],
        start: async (ctx) => {
          await telemetryRuntime.init(config);
          const lifecycleOwner = ctx.get(TELEMETRY_LIFECYCLE_OWNER_TOKEN);
          activeNodeTelemetryLifecycleOwners.add(lifecycleOwner);
        },
        shutdown: async (ctx) => {
          const lifecycleOwner = ctx.get(TELEMETRY_LIFECYCLE_OWNER_TOKEN);
          if (!activeNodeTelemetryLifecycleOwners.delete(lifecycleOwner)) {
            return;
          }

          if (activeNodeTelemetryLifecycleOwners.size === 0) {
            await telemetryRuntime.shutdown();
          }
        },
      }),
    ],
  });
};
