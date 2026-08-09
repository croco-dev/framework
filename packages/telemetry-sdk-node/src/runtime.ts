import type { NodeSDK } from "@opentelemetry/sdk-node";
import type { BatchSpanProcessor, Sampler } from "@opentelemetry/sdk-trace-base";
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import type { TelemetryConfig } from "./config";
import {
  createAutoInstrumentationConfigPlan,
  mergeCustomInstrumentations,
  resolveAutoInstrumentation,
} from "./libs/instrumentation/AutoInstrumentation";
import { TelemetryAutoInstrumentationProblem } from "./libs/problems/TelemetryAutoInstrumentationProblem";
import {
  LegacyTelemetrySignalConfigProblem,
  OtlpEndpointRequiredProblem,
  TelemetryBatchConfigurationProblem,
  TelemetryInitializationConflictProblem,
  TelemetryRuntimeProblem,
} from "./libs/problems/TelemetryProblems";
import { resolveDeploymentEnvironment } from "./libs/resources/DeploymentEnvironment";
import type {
  TelemetryBatchConfigurationConstraint,
  TelemetryBatchConfigurationField,
} from "./libs/problems/TelemetryProblems";

class TelemetryRuntime {
  private static instance: TelemetryRuntime | null = null;
  private sdk: NodeSDK | null = null;
  private processor: BatchSpanProcessor | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private config: TelemetryConfig | null = null;
  private configFingerprint: string | null = null;
  private enabledAutoInstrumentationModules: string[] = [];
  private readonly fingerprintIdentities = new WeakMap<object, number>();
  private nextFingerprintIdentity = 1;

  private constructor() {}

  private async createSampler(config: TelemetryConfig): Promise<Sampler | undefined> {
    const traceConfig = config.trace ?? {};

    if (traceConfig.sampler) {
      return traceConfig.sampler;
    }

    if (traceConfig.probability === undefined) {
      return undefined;
    }

    const { ProbabilitySampler } = await import("./libs/samplers/ProbabilitySampler");
    return new ProbabilitySampler({ probability: traceConfig.probability });
  }

  private createRuntimeProblem(
    phase: "init" | "forceFlush" | "shutdown",
    error: unknown,
  ): TelemetryRuntimeProblem {
    return error instanceof TelemetryRuntimeProblem
      ? error
      : new TelemetryRuntimeProblem(phase, error);
  }

  static getInstance(): TelemetryRuntime {
    if (!TelemetryRuntime.instance) {
      TelemetryRuntime.instance = new TelemetryRuntime();
    }
    return TelemetryRuntime.instance;
  }

  async init(config: TelemetryConfig): Promise<void> {
    const legacySignals = getLegacyTelemetrySignals(config);
    if (legacySignals) {
      throw new LegacyTelemetrySignalConfigProblem(legacySignals);
    }

    validateBatchSpanProcessorConfig(config);

    const requestedConfig = snapshotTelemetryConfig(config);
    const requestedFingerprint = this.createConfigFingerprint(requestedConfig);

    if (this.configFingerprint !== null) {
      if (this.configFingerprint !== requestedFingerprint) {
        throw new TelemetryInitializationConflictProblem(this.getInitializationState());
      }
      if (this.initialized) {
        return;
      }
      if (this.initPromise) {
        return this.initPromise;
      }
      return;
    }

    config = requestedConfig;
    this.config = config;
    this.configFingerprint = requestedFingerprint;

    if (config.enabled === false || config.trace?.enabled === false) {
      // A disabled runtime still owns this configuration until shutdown clears the contract.
      return;
    }

    this.initPromise = (async () => {
      const [
        { defaultResource, resourceFromAttributes },
        { NodeSDK },
        traceBaseModule,
        { OTLPTraceExporter },
      ] = await Promise.all([
        import("@opentelemetry/resources"),
        import("@opentelemetry/sdk-node"),
        import("@opentelemetry/sdk-trace-base"),
        import("@opentelemetry/exporter-trace-otlp-http"),
      ]);

      const BatchSpanProcessor = traceBaseModule.BatchSpanProcessor;

      const traceConfig = config.trace ?? {};
      const sampler = await this.createSampler(config);

      try {
        const instrumentationEnvironment = resolveInstrumentationEnvironment(config);
        const resolvedInstrumentation = await resolveAutoInstrumentation(
          traceConfig.autoInstrumentation,
          instrumentationEnvironment,
          traceConfig.instrumentations ?? [],
        );

        const resource = defaultResource().merge(
          resourceFromAttributes({
            [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
            [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion ?? "0.0.0",
            ...config.resourceAttributes,
            [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: resolveDeploymentEnvironment(config),
          }),
        );

        if (traceConfig.enabled !== false) {
          const endpoint =
            traceConfig.exporterUrl ??
            process.env["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"] ??
            process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];

          if (!endpoint) {
            throw new OtlpEndpointRequiredProblem();
          }

          const exporter = new OTLPTraceExporter({
            url: endpoint,
            ...(traceConfig.exporterHeaders !== undefined && {
              headers: traceConfig.exporterHeaders,
            }),
          });

          this.processor = new BatchSpanProcessor(exporter, {
            scheduledDelayMillis: traceConfig.batchTimeout ?? 5000,
            maxQueueSize: traceConfig.batchCount ?? 2048,
            maxExportBatchSize: traceConfig.batchSize ?? 512,
          });
        }

        this.sdk = new NodeSDK({
          resource,
          ...(this.processor !== null && { spanProcessor: this.processor }),
          ...(sampler !== undefined && { sampler }),
          instrumentations: resolvedInstrumentation.instrumentations,
        });

        this.sdk.start();
        this.enabledAutoInstrumentationModules = resolvedInstrumentation.enabledModules;
        this.initialized = true;
      } catch (error) {
        this.initialized = false;
        this.sdk = null;
        this.processor = null;
        this.enabledAutoInstrumentationModules = [];
        if (
          error instanceof OtlpEndpointRequiredProblem ||
          error instanceof TelemetryAutoInstrumentationProblem
        ) {
          throw error;
        }
        throw this.createRuntimeProblem("init", error);
      }
    })();

    try {
      await this.initPromise;
    } catch (error) {
      this.clearInitializationContract();
      throw error;
    } finally {
      if (this.initialized) {
        this.initPromise = null;
      }
    }
  }

  async forceFlush(timeoutMillis?: number): Promise<ForceFlushResult> {
    const pendingInit = this.initPromise;
    if (pendingInit) {
      try {
        await pendingInit;
      } catch (error) {
        this.initialized = false;
        this.initPromise = null;
        throw error;
      }
    }

    if (!this.processor) {
      const reason = this.getDisabledLifecycleReason();
      return reason
        ? { outcome: "skipped", reason, flushedSpans: 0 }
        : { outcome: "unsupported", reason: "not-initialized", flushedSpans: 0 };
    }

    const effectiveTimeout = timeoutMillis ?? 30000;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const flushPromise = this.processor.forceFlush();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new TelemetryRuntimeProblem("forceFlush", `timed out after ${effectiveTimeout}ms`),
            ),
          effectiveTimeout,
        );
      });

      await Promise.race([flushPromise, timeoutPromise]);

      return {
        outcome: "completed",
        flushedSpans: -1,
      };
    } catch (error) {
      return {
        outcome: "failed",
        flushedSpans: -1,
        error: this.createRuntimeProblem("forceFlush", error),
      };
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  async shutdown(): Promise<ShutdownResult> {
    const pendingInit = this.initPromise;
    if (pendingInit) {
      try {
        await pendingInit;
      } catch (error) {
        this.initialized = false;
        this.initPromise = null;
        throw error;
      }
    }

    if (!this.sdk) {
      const reason = this.getDisabledLifecycleReason();
      this.initialized = false;
      this.initPromise = null;
      this.clearInitializationContract();
      return reason
        ? { outcome: "skipped", reason }
        : { outcome: "unsupported", reason: "not-initialized" };
    }

    try {
      await this.sdk.shutdown();
      this.sdk = null;
      this.processor = null;
      this.enabledAutoInstrumentationModules = [];
      this.initialized = false;
      this.initPromise = null;
      this.clearInitializationContract();
      return { outcome: "completed" };
    } catch (error) {
      throw this.createRuntimeProblem("shutdown", error);
    }
  }

  static async reset(): Promise<void> {
    const instance = TelemetryRuntime.instance;
    if (instance) {
      await instance.shutdown();
      TelemetryRuntime.instance = null;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isEnabled(): boolean {
    return this.isInitialized();
  }

  getConfig(): TelemetryConfig | null {
    if (!this.config) {
      return null;
    }
    return snapshotTelemetryConfig(this.config);
  }

  getEnabledAutoInstrumentationModules(): string[] {
    return [...this.enabledAutoInstrumentationModules];
  }

  private getDisabledLifecycleReason(): TelemetryLifecycleSkipReason | null {
    if (this.config?.enabled === false) {
      return "telemetry-disabled";
    }
    if (this.config?.trace?.enabled === false) {
      return "tracing-disabled";
    }
    return null;
  }

  private getInitializationState(): "disabled" | "initialized" | "initializing" {
    if (this.initPromise) {
      return "initializing";
    }
    return this.initialized ? "initialized" : "disabled";
  }

  private clearInitializationContract(): void {
    this.config = null;
    this.configFingerprint = null;
    this.initPromise = null;
  }

  private createConfigFingerprint(config: TelemetryConfig): string {
    const trace = config.trace ?? {};
    const instrumentationEnvironment = resolveInstrumentationEnvironment(config);
    const autoInstrumentationPlan = createAutoInstrumentationConfigPlan(
      trace.autoInstrumentation,
      instrumentationEnvironment,
    );
    const customInstrumentations = mergeCustomInstrumentations(
      trace.instrumentations ?? [],
      autoInstrumentationPlan.normalized.enabled
        ? (autoInstrumentationPlan.normalized.customInstrumentations ?? [])
        : [],
    );
    const customInstrumentationNames = new Set(
      customInstrumentations
        .map((instrumentation) => instrumentation.instrumentationName ?? "")
        .filter((name) => name.length > 0),
    );
    const automaticModules = autoInstrumentationPlan.selectedNames.filter(
      (module) => !customInstrumentationNames.has(module),
    );
    const autoInstrumentation = {
      enabled: autoInstrumentationPlan.normalized.enabled,
      modules: automaticModules,
      moduleOptions: Object.fromEntries(
        automaticModules.flatMap((module) => {
          const options = autoInstrumentationPlan.optionsByName.get(module);
          return options ? [[module, options]] : [];
        }),
      ),
    };
    const semanticConfig = {
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion ?? "0.0.0",
      environment: resolveDeploymentEnvironment(config),
      enabled: config.enabled !== false,
      resourceAttributes: {
        ...config.resourceAttributes,
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: resolveDeploymentEnvironment(config),
      },
      trace: {
        enabled: trace.enabled !== false,
        exporterUrl:
          trace.exporterUrl ??
          process.env["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"] ??
          process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
        exporterHeaders: trace.exporterHeaders ?? {},
        sampler: trace.sampler ?? null,
        probability: trace.sampler ? undefined : trace.probability,
        batchTimeout: trace.batchTimeout ?? 5000,
        batchCount: trace.batchCount ?? 2048,
        batchSize: trace.batchSize ?? 512,
        instrumentations: customInstrumentations,
        autoInstrumentation,
      },
    };
    return canonicalizeFingerprintValue(semanticConfig, (value) =>
      this.getFingerprintIdentity(value),
    );
  }

  private getFingerprintIdentity(value: object): number {
    const existing = this.fingerprintIdentities.get(value);
    if (existing !== undefined) {
      return existing;
    }
    const identity = this.nextFingerprintIdentity;
    this.nextFingerprintIdentity += 1;
    this.fingerprintIdentities.set(value, identity);
    return identity;
  }
}

const MAX_BATCH_PROCESSOR_INTEGER = 2_147_483_647;
const DEFAULT_BATCH_COUNT = 2048;
const DEFAULT_BATCH_SIZE = 512;

function validateBatchSpanProcessorConfig(config: TelemetryConfig): void {
  const traceConfig = config.trace;
  if (!traceConfig) {
    return;
  }

  validateBatchInteger(traceConfig.batchTimeout, "batchTimeout", 0, "non-negative-int32");
  validateBatchInteger(traceConfig.batchCount, "batchCount", 1, "positive-int32");
  validateBatchInteger(traceConfig.batchSize, "batchSize", 1, "positive-int32");

  const batchCount = traceConfig.batchCount ?? DEFAULT_BATCH_COUNT;
  const batchSize = traceConfig.batchSize ?? DEFAULT_BATCH_SIZE;
  if (batchSize > batchCount) {
    throw new TelemetryBatchConfigurationProblem(
      "batchSize",
      "less-than-or-equal-to-batchCount",
      batchSize,
    );
  }
}

function validateBatchInteger(
  value: unknown,
  field: TelemetryBatchConfigurationField,
  minimum: 0 | 1,
  constraint: Exclude<TelemetryBatchConfigurationConstraint, "less-than-or-equal-to-batchCount">,
): void {
  if (
    value !== undefined &&
    (typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < minimum ||
      value > MAX_BATCH_PROCESSOR_INTEGER)
  ) {
    throw new TelemetryBatchConfigurationProblem(field, constraint, value);
  }
}

function getLegacyTelemetrySignals(
  config: TelemetryConfig,
): readonly ["logs" | "metrics", ...("logs" | "metrics")[]] | undefined {
  const signals: ("logs" | "metrics")[] = [];
  for (const signal of ["metrics", "logs"] as const) {
    if (Object.prototype.hasOwnProperty.call(config, signal)) {
      signals.push(signal);
    }
  }
  const firstSignal = signals[0];
  return firstSignal ? [firstSignal, ...signals.slice(1)] : undefined;
}

function snapshotTelemetryConfig(config: TelemetryConfig): TelemetryConfig {
  return {
    ...config,
    ...(config.resourceAttributes && { resourceAttributes: { ...config.resourceAttributes } }),
    ...(config.trace && {
      trace: {
        ...config.trace,
        ...(config.trace.exporterHeaders && {
          exporterHeaders: { ...config.trace.exporterHeaders },
        }),
        ...(config.trace.instrumentations && {
          instrumentations: [...config.trace.instrumentations],
        }),
        ...(config.trace.autoInstrumentation && {
          autoInstrumentation: {
            ...config.trace.autoInstrumentation,
            ...(config.trace.autoInstrumentation.modules && {
              modules: [...config.trace.autoInstrumentation.modules],
            }),
            ...(config.trace.autoInstrumentation.excludeModules && {
              excludeModules: [...config.trace.autoInstrumentation.excludeModules],
            }),
            ...(config.trace.autoInstrumentation.customInstrumentations && {
              customInstrumentations: [...config.trace.autoInstrumentation.customInstrumentations],
            }),
            ...(config.trace.autoInstrumentation.moduleOptions && {
              moduleOptions: Object.fromEntries(
                Object.entries(config.trace.autoInstrumentation.moduleOptions).map(
                  ([module, options]) => [module, { ...options }],
                ),
              ),
            }),
            ...(config.trace.autoInstrumentation.exclude && {
              exclude: [...config.trace.autoInstrumentation.exclude],
            }),
            ...(config.trace.autoInstrumentation.include && {
              include: [...config.trace.autoInstrumentation.include],
            }),
          },
        }),
      },
    }),
  };
}

function resolveInstrumentationEnvironment(config: TelemetryConfig): "lambda" | "node" {
  return config.resourceAttributes?.["cloud.platform"] === "aws_lambda" ||
    process.env["AWS_LAMBDA_FUNCTION_NAME"] !== undefined ||
    process.env["AWS_EXECUTION_ENV"]?.includes("AWS_Lambda") === true
    ? "lambda"
    : "node";
}

function canonicalizeFingerprintValue(
  value: unknown,
  getIdentity: (value: object) => number,
  ancestors = new WeakSet<object>(),
): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isNaN(value) ? "number:NaN" : `number:${String(value)}`;
  }
  if (typeof value === "function") {
    return `identity:${getIdentity(value)}`;
  }
  if (typeof value !== "object") {
    return `${typeof value}:${String(value)}`;
  }

  if (ancestors.has(value)) {
    return `identity:${getIdentity(value)}`;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) {
    return `identity:${getIdentity(value)}`;
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => canonicalizeFingerprintValue(entry, getIdentity, ancestors)).join(",")}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalizeFingerprintValue(record[key], getIdentity, ancestors)}`,
      )
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

type TelemetryLifecycleSkipReason = "telemetry-disabled" | "tracing-disabled";

type ForceFlushResult =
  | { outcome: "completed"; flushedSpans: -1 }
  | { outcome: "skipped"; reason: TelemetryLifecycleSkipReason; flushedSpans: 0 }
  | { outcome: "unsupported"; reason: "not-initialized"; flushedSpans: 0 }
  | { outcome: "failed"; flushedSpans: -1; error: TelemetryRuntimeProblem };

type ShutdownResult =
  | { outcome: "completed" }
  | { outcome: "skipped"; reason: TelemetryLifecycleSkipReason }
  | { outcome: "unsupported"; reason: "not-initialized" };

export { TelemetryRuntime };
export type { ForceFlushResult, ShutdownResult, TelemetryLifecycleSkipReason };
