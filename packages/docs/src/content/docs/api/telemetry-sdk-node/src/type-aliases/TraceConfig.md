---
editUrl: false
next: false
prev: false
title: "TraceConfig"
---

> **TraceConfig** = `object`

Defined in: [packages/telemetry-sdk-node/src/config.ts:14](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/config.ts#L14)

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

### batchCount?

> `optional` **batchCount**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:20](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/config.ts#L20)

***

### batchSize?

> `optional` **batchSize**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:21](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/config.ts#L21)

***

### batchTimeout?

> `optional` **batchTimeout**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:19](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/config.ts#L19)

***

### enabled?

> `optional` **enabled**: `boolean`

Defined in: [packages/telemetry-sdk-node/src/config.ts:15](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/config.ts#L15)

***

### exporterHeaders?

> `optional` **exporterHeaders**: `Record`\<`string`, `string`\>

Defined in: [packages/telemetry-sdk-node/src/config.ts:17](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/config.ts#L17)

***

### exporterUrl?

> `optional` **exporterUrl**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:16](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/config.ts#L16)

***

### instrumentations?

> `optional` **instrumentations**: `never`[]

Defined in: [packages/telemetry-sdk-node/src/config.ts:22](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/config.ts#L22)

***

### sampler?

> `optional` **sampler**: `Sampler`

Defined in: [packages/telemetry-sdk-node/src/config.ts:18](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/config.ts#L18)
