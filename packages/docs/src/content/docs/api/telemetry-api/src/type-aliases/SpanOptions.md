---
editUrl: false
next: false
prev: false
title: "SpanOptions"
---

> **SpanOptions** = `object`

Defined in: [packages/telemetry-api/src/libs/span.ts:4](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-api/src/libs/span.ts#L4)

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

### attributes?

> `optional` **attributes**: `Attributes`

Defined in: [packages/telemetry-api/src/libs/span.ts:6](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-api/src/libs/span.ts#L6)

***

### name?

> `optional` **name**: `string`

Defined in: [packages/telemetry-api/src/libs/span.ts:5](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-api/src/libs/span.ts#L5)
