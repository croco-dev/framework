---
editUrl: false
next: false
prev: false
title: "MetricsConfig"
---

> **MetricsConfig** = `object`

Defined in: [packages/telemetry-sdk-node/src/config.ts:25](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L25)

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

Defined in: [packages/telemetry-sdk-node/src/config.ts:26](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L26)

***

### exporterHeaders?

> `optional` **exporterHeaders**: `Record`\<`string`, `string`\>

Defined in: [packages/telemetry-sdk-node/src/config.ts:28](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L28)

***

### exporterUrl?

> `optional` **exporterUrl**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:27](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L27)

***

### exportIntervalMillis?

> `optional` **exportIntervalMillis**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:29](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L29)

***

### exportTimeoutMillis?

> `optional` **exportTimeoutMillis**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:30](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L30)
