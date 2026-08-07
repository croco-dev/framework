---
editUrl: false
next: false
prev: false
title: "TelemetryConfig"
---

> **TelemetryConfig** = `object`

Main configuration for the OpenTelemetry SDK.

This is the top-level configuration object passed to TelemetryRuntime.init.
It combines service metadata with executable trace configuration.

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
};
```

## Properties

### enabled?

> `optional` **enabled?**: `boolean`

Whether telemetry is globally enabled. Default: true

***

### environment?

> `optional` **environment?**: `string`

Deployment environment. Overrides deployment.environment.name in resourceAttributes. Default: 'development'

***

### resourceAttributes?

> `optional` **resourceAttributes?**: `Record`\<`string`, `string` \| `number` \| `boolean`\>

Additional resource attributes

***

### serviceName

> **serviceName**: `string`

Service name (required)

***

### serviceVersion?

> `optional` **serviceVersion?**: `string`

Service version. Default: '0.0.0'

***

### trace?

> `optional` **trace?**: [`TraceConfig`](/api/telemetry-sdk-node/src/type-aliases/traceconfig/)

Trace configuration
