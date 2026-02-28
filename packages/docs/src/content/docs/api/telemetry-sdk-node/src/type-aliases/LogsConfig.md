---
editUrl: false
next: false
prev: false
title: "LogsConfig"
---

> **LogsConfig** = `object`

Defined in: [packages/telemetry-sdk-node/src/config.ts:33](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L33)

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

Defined in: [packages/telemetry-sdk-node/src/config.ts:34](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/config.ts#L34)
