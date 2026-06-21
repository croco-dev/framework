/**
 * `@Trace` 데코레이터의 동작을 제어하는 옵션 타입입니다.
 *
 * @property name - Span 이름입니다. 기본값은 메서드 이름입니다.
 * @property attributes - Span에 추가할 속성 집합입니다.
 */
export type { TraceDecoratorOptions } from "./libs/decorators/Trace.js";

/**
 * 비동기 메서드 실행을 자동으로 Span으로 감싸는 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class OrderService {
 *   @Trace({ name: 'order.create' })
 *   async createOrder() {}
 * }
 * ```
 */
export { Trace } from "./libs/decorators/Trace.js";

/**
 * Span 생성 옵션과 현재 활성 Trace 정보를 표현하는 타입입니다.
 */
export type { SpanOptions, TraceInfo } from "./libs/span.js";

/**
 * 브라우저 상호작용과 생성된 RPC 클라이언트 요청을 연결하는 provider-neutral telemetry bridge 타입입니다.
 */
export type {
  FrontendTelemetryBridge,
  FrontendTelemetryBridgeOptions,
  FrontendTelemetryEvent,
  FrontendTelemetryEventKind,
  FrontendTelemetryHeaderNames,
  FrontendTelemetryProblemSummary,
  FrontendTelemetryRequestContext,
  FrontendTelemetryRouteKind,
  FrontendTelemetrySink,
} from "./libs/frontendBridge.js";

/**
 * 브라우저에서 사용할 수 있는 interaction/correlation header bridge를 생성합니다.
 */
export {
  createFrontendInteractionId,
  createFrontendTelemetryBridge,
} from "./libs/frontendBridge.js";

/**
 * Span 실행, 이벤트 기록, 에러 기록, 현재 Trace 조회를 위한 유틸리티 함수입니다.
 */
export { getActiveTraceInfo, recordError, recordEvent, withSpan } from "./libs/span.js";

/**
 * Tracer 인스턴스를 만들 때 사용하는 옵션 타입입니다.
 */
export type { TracerOptions } from "./libs/tracer.js";

/**
 * 수동 Span 생성이 필요할 때 OpenTelemetry Tracer를 반환합니다.
 */
export { getTracer } from "./libs/tracer.js";
