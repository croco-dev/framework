/**
 * `@Trace` 데코레이터의 동작을 제어하는 옵션 타입입니다.
 *
 * @property name - Span 이름입니다. 기본값은 메서드 이름입니다.
 * @property attributes - Span에 추가할 속성 집합입니다.
 */
export type { TraceDecoratorOptions } from './libs/decorators/Trace.js';

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
export { Trace } from './libs/decorators/Trace.js';

/**
 * Span 생성 옵션과 현재 활성 Trace 정보를 표현하는 타입입니다.
 */
export type { SpanOptions, TraceInfo } from './libs/span.js';

/**
 * Span 실행, 이벤트 기록, 에러 기록, 현재 Trace 조회를 위한 유틸리티 함수입니다.
 */
export { getActiveTraceInfo, recordError, recordEvent, withSpan } from './libs/span.js';

/**
 * Tracer 인스턴스를 만들 때 사용하는 옵션 타입입니다.
 */
export type { TracerOptions } from './libs/tracer.js';

/**
 * 수동 Span 생성이 필요할 때 OpenTelemetry Tracer를 반환합니다.
 */
export { getTracer } from './libs/tracer.js';
