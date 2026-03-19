---
editUrl: false
next: false
prev: false
title: "TracerOptions"
---

> **TracerOptions** = `object`

Defined in: [packages/telemetry-api/src/libs/tracer.ts:6](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-api/src/libs/tracer.ts#L6)

Options for configuring a Tracer instance.

## Remarks

Used when getting a tracer for advanced/manual tracing scenarios.

## Example

```typescript
const tracer = getTracer({ name: 'my-service', version: '1.0.0' });
```

## Properties

### name?

> `optional` **name**: `string`

Defined in: [packages/telemetry-api/src/libs/tracer.ts:7](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-api/src/libs/tracer.ts#L7)

Instrumentation name (usually service/module name)

***

### version?

> `optional` **version**: `string`

Defined in: [packages/telemetry-api/src/libs/tracer.ts:8](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-api/src/libs/tracer.ts#L8)

Instrumentation version for identification
