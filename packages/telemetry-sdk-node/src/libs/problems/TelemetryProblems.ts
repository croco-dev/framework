import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 샘플링 설정값이 유효하지 않을 때 발생하는 Problem입니다.
 */
export class SamplerProblem extends Problem {
  readonly code = "TELEMETRY_SAMPLER_INVALID_CONFIG";
  readonly category = ProblemCategory.BadRequest;

  constructor(detail: string) {
    super("TELEMETRY_SAMPLER_INVALID_CONFIG", ProblemCategory.BadRequest, detail);
  }
}

/**
 * OTLP exporter 엔드포인트가 누락되었을 때 발생하는 Problem입니다.
 */
export class OtlpEndpointRequiredProblem extends Problem {
  readonly code = "OTLP_ENDPOINT_REQUIRED";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super(
      "OTLP_ENDPOINT_REQUIRED",
      ProblemCategory.InternalServerError,
      "OTLP endpoint is required for telemetry",
    );
  }
}

type LegacyTelemetrySignalName = "logs" | "metrics";

/**
 * Rejects removed signal configuration passed by untyped or JavaScript consumers.
 * This migration Problem is intentionally not exported from the package entrypoint.
 */
export class LegacyTelemetrySignalConfigProblem extends Problem {
  readonly code = "TELEMETRY_SIGNAL_UNSUPPORTED";
  readonly category = ProblemCategory.BadRequest;
  readonly signals: readonly LegacyTelemetrySignalName[];

  constructor(signals: readonly [LegacyTelemetrySignalName, ...LegacyTelemetrySignalName[]]) {
    super(
      "TELEMETRY_SIGNAL_UNSUPPORTED",
      ProblemCategory.BadRequest,
      `TelemetryRuntime supports traces only; remove ${signals.join(" and ")} configuration before initialization`,
    );
    this.signals = [...signals];
  }
}

/**
 * 초기화 전에 호출된 지원되지 않는 telemetry `forceFlush()`를 나타내는 Problem입니다.
 */
export class TelemetryForceFlushUnsupportedProblem extends Problem {
  readonly code = "TELEMETRY_FORCE_FLUSH_UNSUPPORTED";
  readonly category = ProblemCategory.NotImplemented;

  constructor() {
    super(
      "TELEMETRY_FORCE_FLUSH_UNSUPPORTED",
      ProblemCategory.NotImplemented,
      "Telemetry forceFlush is unsupported before initialization.",
    );
  }
}

export class TelemetryRuntimeProblem extends Problem {
  readonly code = "TELEMETRY_RUNTIME_ERROR";
  readonly category = ProblemCategory.InternalServerError;

  constructor(phase: "init" | "forceFlush" | "shutdown", cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    const causeError = cause instanceof Error ? cause : new Error(String(cause));
    super(
      "TELEMETRY_RUNTIME_ERROR",
      ProblemCategory.InternalServerError,
      `Telemetry ${phase} failed: ${detail}`,
      { cause: causeError },
    );
  }
}
