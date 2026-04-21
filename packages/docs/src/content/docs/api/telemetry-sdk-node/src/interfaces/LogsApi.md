---
editUrl: false
next: false
prev: false
title: "LogsApi"
---

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:160](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L160)

Logs API provides methods to create and use loggers.
This is a Croco abstraction over OpenTelemetry Logs API.

## Example

```typescript
const logs = TelemetryRuntime.getInstance().getLogs();
const logger = logs.getLogger({ name: 'my-service' });

logger.info('Service initialized');
```

## Methods

### getLogger()

> **getLogger**(`options`): [`Logger`](/api/telemetry-sdk-node/src/interfaces/logger/)

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:167](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L167)

Gets or creates a logger instance.

#### Parameters

##### options

[`LoggerOptions`](/api/telemetry-sdk-node/src/interfaces/loggeroptions/)

Logger configuration options

#### Returns

[`Logger`](/api/telemetry-sdk-node/src/interfaces/logger/)

A Logger instance
