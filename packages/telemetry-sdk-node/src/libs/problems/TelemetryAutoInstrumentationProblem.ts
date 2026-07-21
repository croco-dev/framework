import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 자동 계측 설정을 설치된 OpenTelemetry 런타임이 정확히 실행할 수 없을 때 발생합니다.
 */
export class TelemetryAutoInstrumentationProblem extends Problem {
  readonly code = "TELEMETRY_AUTO_INSTRUMENTATION_INVALID_CONFIG";
  readonly category = ProblemCategory.ValidationError;

  constructor(detail: string) {
    super("TELEMETRY_AUTO_INSTRUMENTATION_INVALID_CONFIG", ProblemCategory.ValidationError, detail);
  }
}
