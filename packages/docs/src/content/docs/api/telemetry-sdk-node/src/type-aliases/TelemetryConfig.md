---
editUrl: false
next: false
prev: false
title: "TelemetryConfig"
---

> **TelemetryConfig** = `object`

Defined in: [packages/telemetry-sdk-node/src/config.ts:3](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L3)

Main configuration for the OpenTelemetry SDK.

## Remarks

This is the top-level configuration object passed to [TelemetryRuntime.init](/api/telemetry-sdk-node/src/classes/telemetryruntime/#init).
It combines service metadata with trace, metrics, and logs configurations.

## Example

```ts
const config: TelemetryConfig = {
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  environment: 'production',
  enabled: true,
  trace: {
    enabled: true,
    exporterUrl: 'http://localhost:4318/v1/traces',
  },
  metrics: { enabled: false },
  logs: { enabled: false },
};
```

## Properties

### enabled?

> `optional` **enabled**: `boolean`

Defined in: [packages/telemetry-sdk-node/src/config.ts:7](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L7)

***

### environment?

> `optional` **environment**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:6](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L6)

***

### logs?

> `optional` **logs**: [`LogsConfig`](/api/telemetry-sdk-node/src/type-aliases/logsconfig/)

Defined in: [packages/telemetry-sdk-node/src/config.ts:10](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L10)

***

### metrics?

> `optional` **metrics**: [`MetricsConfig`](/api/telemetry-sdk-node/src/type-aliases/metricsconfig/)

Defined in: [packages/telemetry-sdk-node/src/config.ts:9](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L9)

***

### resourceAttributes?

> `optional` **resourceAttributes**: `Record`\<`string`, `string` \| `number` \| `boolean`\>

Defined in: [packages/telemetry-sdk-node/src/config.ts:11](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L11)

***

### serviceName

> **serviceName**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:4](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L4)

***

### serviceVersion?

> `optional` **serviceVersion**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:5](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L5)

***

### trace?

> `optional` **trace**: [`TraceConfig`](/api/telemetry-sdk-node/src/type-aliases/traceconfig/)

Defined in: [packages/telemetry-sdk-node/src/config.ts:8](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L8)
