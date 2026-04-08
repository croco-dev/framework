/**
 * Options for configuring the @Trace decorator behavior.
 *
 * @remarks
 * Allows customization of the Span name and additional attributes.
 *
 * @property name - Custom Span name (defaults to method name)
 * @property attributes - Additional key-value pairs to attach to the Span
 *
 * @example
 * ```typescript
 * class PaymentService {
 *   @Trace({
 *     name: 'process-payment',
 *     attributes: { 'service.type': 'payment' }
 *   })
 *   async processPayment(amount: number): Promise<void> {
 *     // ...
 *   }
 * }
 * ```
 */
export type { TraceDecoratorOptions } from './libs/decorators/Trace.js';

/**
 * Decorator that automatically traces async method execution.
 *
 * @remarks
 * Wraps the method in an OpenTelemetry Span, recording execution time and errors.
 * Must be used after SDK initialization via @croco/telemetry-sdk-node.
 *
 * @example
 * ```typescript
 * import { Trace } from '@croco/telemetry-api';
 *
 * class OrderService {
 *   @Trace({ name: 'place-order' })
 *   async placeOrder(dto: CreateOrderDto): Promise<Order> {
 *     return this.repository.save(dto);
 *   }
 * }
 * ```
 */
export { Trace } from './libs/decorators/Trace.js';

/**
 * Options for configuring a Span's behavior.
 *
 * @remarks
 * Used with withSpan function to customize Span creation.
 *
 * @property name - Span name for identification
 * @property attributes - Additional metadata to attach to the Span
 *
 * @example
 * ```typescript
 * await withSpan(async () => {
 *   // work here
 * }, { name: 'fetch-data', attributes: { source: 'api' } });
 * ```
 */

/**
 * Information about the current active trace context.
 *
 * @remarks
 * Contains trace ID, span ID, and sampling status for distributed tracing.
 *
 * @property traceId - Unique identifier for the entire trace
 * @property spanId - Unique identifier for the current span
 * @property traceFlags - W3C trace context flags
 * @property isValid - Whether this trace is sampled for recording
 *
 * @example
 * ```typescript
 * const traceInfo = getActiveTraceInfo();
 * ```
 */
export type { SpanOptions, TraceInfo } from './libs/span.js';

/**
 * Wraps a function execution within a Span.
 *
 * @remarks
 * Creates a new Span, executes the function with access to the Span instance,
 * and automatically ends the Span after completion. Errors are recorded and re-thrown.
 *
 * @param fn - Async function to execute, receives Span instance as parameter
 * @param options - Span configuration (name and attributes)
 * @returns Promise resolving to the function's return value
 *
 * @example
 * ```typescript
 * const result = await withSpan(async (span) => {
 *   span.setAttribute('user.id', userId);
 *   return await fetchData();
 * }, { name: 'fetch-data', attributes: { source: 'api' } });
 * ```
 */

/**
 * Records a named event to the current active Span.
 *
 * @remarks
 * Adds a timed event with optional attributes. Useful for marking business milestones.
 *
 * @param name - Event name for identification
 * @param attributes - Optional key-value pairs associated with this event
 *
 * @example
 * ```typescript
 * @Trace()
 * async processOrder() {
 *   recordEvent('order.validated', { 'order.id': orderId });
 *   recordEvent('inventory.reserved', { sku, quantity });
 * }
 * ```
 */

/**
 * Records an error to the current active Span.
 *
 * @remarks
 * Marks the Span as having an error without ending it. Use within try-catch blocks.
 *
 * @param error - The error to record (Error instance or unknown)
 * @param span - Optional specific span to record to (defaults to current active span)
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   recordError(error); // records to current span
 *   throw error;
 * }
 * ```
 */

/**
 * Retrieves information about the currently active trace.
 *
 * @remarks
 * Returns trace ID, span ID, and sampling status from the AsyncLocalStorage context.
 * Useful for adding trace IDs to logs or passing trace context externally.
 *
 * @returns TraceInfo object with trace details, or empty object if no active trace
 *
 * @example
 * ```typescript
 * @Trace()
 * async handleRequest() {
 *   const traceInfo = getActiveTraceInfo();
 *   logger.info('Processing', { traceId: traceInfo.traceId });
 * }
 * ```
 */
export { getActiveTraceInfo, recordError, recordEvent, withSpan } from './libs/span.js';

/**
 * Options for configuring a Tracer instance.
 *
 * @remarks
 * Used when getting a tracer for advanced/manual tracing scenarios.
 *
 * @property name - Instrumentation name (usually service/module name)
 * @property version - Instrumentation version for identification
 *
 * @example
 * ```typescript
 * const tracer = getTracer({ name: 'my-service', version: '1.0.0' });
 * ```
 */
export type { TracerOptions } from './libs/tracer.js';

/**
 * Retrieves an OpenTelemetry Tracer instance.
 *
 * @remarks
 * Advanced API for manual Span creation. In most cases, @Trace decorator or
 * withSpan function should be used instead.
 *
 * @param options - Tracer configuration with name and optional version
 * @returns Configured OpenTelemetry Tracer instance
 *
 * @example
 * ```typescript
 * const tracer = getTracer({ name: 'my-service', version: '1.0.0' });
 * const span = tracer.startSpan('manual-span');
 * try {
 *   // work here
 * } finally {
 *   span.end();
 * }
 * ```
 */
export { getTracer } from './libs/tracer.js';
