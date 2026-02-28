---
editUrl: false
next: false
prev: false
title: "TracerOptions"
---

> **TracerOptions** = `object`

Defined in: [packages/telemetry-api/src/libs/tracer.ts:6](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-api/src/libs/tracer.ts#L6)

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

Defined in: [packages/telemetry-api/src/libs/tracer.ts:7](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-api/src/libs/tracer.ts#L7)

Instrumentation name (usually service/module name)

***

### version?

> `optional` **version**: `string`

Defined in: [packages/telemetry-api/src/libs/tracer.ts:8](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-api/src/libs/tracer.ts#L8)

Instrumentation version for identification
