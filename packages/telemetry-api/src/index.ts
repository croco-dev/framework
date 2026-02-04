export type { TraceDecoratorOptions } from './libs/decorators/Trace.js';
export { Trace } from './libs/decorators/Trace.js';
export type { SpanOptions, TraceInfo } from './libs/span.js';
export { getActiveTraceInfo, recordError, recordEvent, withSpan } from './libs/span.js';
export type { TracerOptions } from './libs/tracer.js';
export { getTracer } from './libs/tracer.js';
