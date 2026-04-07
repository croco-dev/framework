---
editUrl: false
next: false
prev: false
title: "TraceInfo"
---

> **TraceInfo** = `object`

Defined in: [packages/telemetry-api/src/libs/span.ts:9](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-api/src/libs/span.ts#L9)

Information about the current active trace context.

## Remarks

Contains trace ID, span ID, and sampling status for distributed tracing.

## Example

```typescript
const traceInfo = getActiveTraceInfo();
console.log('Trace ID:', traceInfo.traceId);
console.log('Is Sampled:', traceInfo.isValid);
```

## Properties

### isValid?

> `optional` **isValid**: `boolean`

Defined in: [packages/telemetry-api/src/libs/span.ts:13](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-api/src/libs/span.ts#L13)

Whether this trace is sampled for recording

***

### spanId?

> `optional` **spanId**: `string`

Defined in: [packages/telemetry-api/src/libs/span.ts:11](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-api/src/libs/span.ts#L11)

Unique identifier for the current span

***

### traceFlags?

> `optional` **traceFlags**: `number`

Defined in: [packages/telemetry-api/src/libs/span.ts:12](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-api/src/libs/span.ts#L12)

W3C trace context flags

***

### traceId?

> `optional` **traceId**: `string`

Defined in: [packages/telemetry-api/src/libs/span.ts:10](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-api/src/libs/span.ts#L10)

Unique identifier for the entire trace
