import { type Tracer, trace } from "@opentelemetry/api";

const DEFAULT_TRACER_NAME = "@croco/telemetry-api";
const DEFAULT_TRACER_VERSION = "0.0.1";

export type TracerOptions = {
  name?: string;
  version?: string;
};

/**
 * 수동 Span 생성에 사용할 OpenTelemetry Tracer를 반환합니다.
 */
export function getTracer(options: TracerOptions = {}): Tracer {
  const { name = DEFAULT_TRACER_NAME, version = DEFAULT_TRACER_VERSION } = options;
  return trace.getTracer(name, version);
}
