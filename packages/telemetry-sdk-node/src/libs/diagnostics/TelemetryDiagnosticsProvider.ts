import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { TelemetryRuntime } from "../../runtime";
import {
  createTelemetryConfigurationDiagnosticsSnapshot,
  getTelemetryInitializationFailure,
} from "./TelemetryInitializationState";
import type { TelemetryConfigurationDiagnosticsSnapshot } from "./TelemetryInitializationState";

export type TelemetryDiagnosticsRequirement = "optional" | "required";

export type TelemetryDiagnosticsMode =
  | "active"
  | "disabled"
  | "external_tracer_provider"
  | "not_configured"
  | "not_initialized"
  | "sampling_disabled"
  | "startup_failed";

type TelemetryDiagnosticsDetailsBase = {
  readonly requirement: TelemetryDiagnosticsRequirement;
  readonly initialized: boolean;
  readonly autoInstrumentationModules: readonly string[];
};

export type TelemetryNotConfiguredDiagnosticsDetails = TelemetryDiagnosticsDetailsBase & {
  readonly configured: false;
  readonly enabled: false;
  readonly traceEnabled: false;
  readonly signals: { readonly traces: "not_configured" };
  readonly mode: "not_configured";
};

export type TelemetryConfiguredDiagnosticsDetails = TelemetryDiagnosticsDetailsBase &
  TelemetryConfigurationDiagnosticsSnapshot & {
    readonly configured: true;
    readonly mode:
      | "active"
      | "disabled"
      | "external_tracer_provider"
      | "not_initialized"
      | "sampling_disabled";
  };

export type TelemetryStartupFailedDiagnosticsDetails = TelemetryDiagnosticsDetailsBase &
  TelemetryConfigurationDiagnosticsSnapshot & {
    readonly configured: true;
    readonly initialized: false;
    readonly mode: "startup_failed";
    readonly failureCode: string;
  };

export type TelemetryDiagnosticsDetails =
  | TelemetryNotConfiguredDiagnosticsDetails
  | TelemetryConfiguredDiagnosticsDetails
  | TelemetryStartupFailedDiagnosticsDetails;

export type TelemetryDiagnosticsHealthStatus = Omit<HealthStatus, "component" | "details"> & {
  readonly component: "telemetry";
  readonly details: TelemetryDiagnosticsDetails;
};

export type TelemetryDiagnosticsProviderOptions = {
  /** Whether missing configuration or failed startup makes this host unhealthy. Default: optional. */
  readonly requirement?: TelemetryDiagnosticsRequirement;
};

export class TelemetryDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "telemetry";
  private readonly requirement: TelemetryDiagnosticsRequirement;

  constructor(options: TelemetryDiagnosticsProviderOptions = {}) {
    this.requirement = options.requirement ?? "optional";
  }

  async getHealth(): Promise<TelemetryDiagnosticsHealthStatus> {
    const runtime = TelemetryRuntime.getInstance();
    const config = runtime.getConfig();
    const initialized = runtime.isInitialized();
    const lifecycleSkipReason = runtime.getLifecycleSkipReason();

    if (
      config &&
      (lifecycleSkipReason === "telemetry-disabled" ||
        lifecycleSkipReason === "tracing-disabled" ||
        lifecycleSkipReason === "sdk-disabled")
    ) {
      const message =
        lifecycleSkipReason === "sdk-disabled"
          ? "Telemetry disabled by OTEL_SDK_DISABLED; SDK startup and export are skipped"
          : `Telemetry ${lifecycleSkipReason === "telemetry-disabled" ? "runtime" : "tracing"} disabled by configuration; SDK startup and export are skipped`;
      return {
        status: "degraded",
        component: "telemetry",
        message,
        details: createConfiguredTelemetryDetails(
          createTelemetryConfigurationDiagnosticsSnapshot(config),
          initialized,
          "disabled",
          this.requirement,
          runtime.getEnabledAutoInstrumentationModules(),
        ),
        lastChecked: new Date().toISOString(),
      };
    }

    if (!config) {
      const failure = getTelemetryInitializationFailure(runtime);
      if (failure) {
        return {
          status: this.requirement === "required" ? "unhealthy" : "degraded",
          component: "telemetry",
          message: `${capitalize(this.requirement)} telemetry failed to initialize`,
          details: {
            ...failure.snapshot,
            requirement: this.requirement,
            configured: true,
            initialized: false,
            autoInstrumentationModules: [],
            mode: "startup_failed",
            failureCode: failure.code,
          },
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: this.requirement === "required" ? "unhealthy" : "degraded",
        component: "telemetry",
        message: `${capitalize(this.requirement)} telemetry is not configured`,
        details: {
          requirement: this.requirement,
          configured: false,
          enabled: false,
          initialized,
          traceEnabled: false,
          signals: { traces: "not_configured" },
          autoInstrumentationModules: [],
          mode: "not_configured",
        },
        lastChecked: new Date().toISOString(),
      };
    }

    const snapshot = createTelemetryConfigurationDiagnosticsSnapshot(config);
    const autoInstrumentationModules = runtime.getEnabledAutoInstrumentationModules();
    if (!initialized) {
      return {
        status: this.requirement === "required" ? "unhealthy" : "degraded",
        component: "telemetry",
        message: `${capitalize(this.requirement)} telemetry is not initialized`,
        details: createConfiguredTelemetryDetails(
          snapshot,
          initialized,
          "not_initialized",
          this.requirement,
          autoInstrumentationModules,
        ),
        lastChecked: new Date().toISOString(),
      };
    }

    if (lifecycleSkipReason === "external-tracer-provider") {
      return {
        status: "degraded",
        component: "telemetry",
        message: "An external tracer provider is global; Croco trace export is inactive",
        details: createConfiguredTelemetryDetails(
          snapshot,
          initialized,
          "external_tracer_provider",
          this.requirement,
          autoInstrumentationModules,
        ),
        lastChecked: new Date().toISOString(),
      };
    }

    if (snapshot.probability === 0) {
      return {
        status: "healthy",
        component: "telemetry",
        message:
          "Telemetry root sampling probability is 0; sampled parent traces are still recorded",
        details: createConfiguredTelemetryDetails(
          snapshot,
          initialized,
          "active",
          this.requirement,
          autoInstrumentationModules,
        ),
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: "healthy",
      component: "telemetry",
      details: createConfiguredTelemetryDetails(
        snapshot,
        initialized,
        "active",
        this.requirement,
        autoInstrumentationModules,
      ),
      lastChecked: new Date().toISOString(),
    };
  }
}

function createConfiguredTelemetryDetails(
  snapshot: TelemetryConfigurationDiagnosticsSnapshot,
  initialized: boolean,
  mode: TelemetryConfiguredDiagnosticsDetails["mode"],
  requirement: TelemetryDiagnosticsRequirement,
  autoInstrumentationModules: readonly string[],
): TelemetryConfiguredDiagnosticsDetails {
  return {
    ...snapshot,
    requirement,
    configured: true,
    initialized,
    autoInstrumentationModules,
    mode,
  };
}

function capitalize(value: TelemetryDiagnosticsRequirement): "Optional" | "Required" {
  return value === "optional" ? "Optional" : "Required";
}
