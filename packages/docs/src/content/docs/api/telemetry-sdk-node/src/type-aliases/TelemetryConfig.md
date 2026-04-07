---
editUrl: false
next: false
prev: false
title: "TelemetryConfig"
---

> **TelemetryConfig** = `object`

Defined in: [packages/telemetry-sdk-node/src/config.ts:94](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L94)

Main configuration for the OpenTelemetry SDK.

This is the top-level configuration object passed to TelemetryRuntime.init.
It combines service metadata with trace, metrics, and logs configurations.

## Example

```typescript
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

Defined in: [packages/telemetry-sdk-node/src/config.ts:102](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L102)

Whether telemetry is globally enabled. Default: true

***

### environment?

> `optional` **environment**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:100](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L100)

Deployment environment. Default: 'development'

***

### logs?

> `optional` **logs**: [`LogsConfig`](/api/telemetry-sdk-node/src/type-aliases/logsconfig/)

Defined in: [packages/telemetry-sdk-node/src/config.ts:108](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L108)

Logs configuration

***

### metrics?

> `optional` **metrics**: [`MetricsConfig`](/api/telemetry-sdk-node/src/type-aliases/metricsconfig/)

Defined in: [packages/telemetry-sdk-node/src/config.ts:106](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L106)

Metrics configuration

***

### resourceAttributes?

> `optional` **resourceAttributes**: `Record`\<`string`, `string` \| `number` \| `boolean`\>

Defined in: [packages/telemetry-sdk-node/src/config.ts:110](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L110)

Additional resource attributes

***

### serviceName

> **serviceName**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:96](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L96)

Service name (required)

***

### serviceVersion?

> `optional` **serviceVersion**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:98](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L98)

Service version. Default: '0.0.0'

***

### trace?

> `optional` **trace**: [`TraceConfig`](/api/telemetry-sdk-node/src/type-aliases/traceconfig/)

Defined in: [packages/telemetry-sdk-node/src/config.ts:104](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L104)

Trace configuration
