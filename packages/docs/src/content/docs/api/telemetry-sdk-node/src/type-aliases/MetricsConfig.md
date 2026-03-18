---
editUrl: false
next: false
prev: false
title: "MetricsConfig"
---

> **MetricsConfig** = `object`

Defined in: [packages/telemetry-sdk-node/src/config.ts:26](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/config.ts#L26)

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

Defined in: [packages/telemetry-sdk-node/src/config.ts:27](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/config.ts#L27)

***

### exporterHeaders?

> `optional` **exporterHeaders**: `Record`\<`string`, `string`\>

Defined in: [packages/telemetry-sdk-node/src/config.ts:29](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/config.ts#L29)

***

### exporterUrl?

> `optional` **exporterUrl**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:28](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/config.ts#L28)

***

### exportIntervalMillis?

> `optional` **exportIntervalMillis**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:30](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/config.ts#L30)

***

### exportTimeoutMillis?

> `optional` **exportTimeoutMillis**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:31](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/config.ts#L31)
