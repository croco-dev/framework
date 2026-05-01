---
editUrl: false
next: false
prev: false
title: "LogsApi"
---

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

Gets or creates a logger instance.

#### Parameters

##### options

[`LoggerOptions`](/api/telemetry-sdk-node/src/interfaces/loggeroptions/)

Logger configuration options

#### Returns

[`Logger`](/api/telemetry-sdk-node/src/interfaces/logger/)

A Logger instance
