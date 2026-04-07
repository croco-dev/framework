---
editUrl: false
next: false
prev: false
title: "Logger"
---

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:77](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L77)

Logger interface for structured logging.
Provides methods to emit logs at different severity levels.

## Example

```typescript
const logger = TelemetryRuntime.getInstance().getLogger();

logger.info('Application started');
logger.error('Failed to connect', { error: err.message });
logger.debug('Processing request', { requestId: 'abc123' });
```

## Methods

### debug()

> **debug**(`body`, `attributes?`): `void`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:99](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L99)

Logs a message at DEBUG level.

#### Parameters

##### body

The log message or structured data

`string` | `Record`\<`string`, `unknown`\>

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`

***

### emit()

> **emit**(`options`): `void`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:83](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L83)

Emits a log record.

#### Parameters

##### options

[`LogRecordOptions`](/api/telemetry-sdk-node/src/interfaces/logrecordoptions/)

Log record options

#### Returns

`void`

***

### error()

> **error**(`body`, `attributes?`): `void`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:123](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L123)

Logs a message at ERROR level.

#### Parameters

##### body

The log message or structured data

`string` | `Record`\<`string`, `unknown`\>

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`

***

### fatal()

> **fatal**(`body`, `attributes?`): `void`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:131](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L131)

Logs a message at FATAL level.

#### Parameters

##### body

The log message or structured data

`string` | `Record`\<`string`, `unknown`\>

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`

***

### info()

> **info**(`body`, `attributes?`): `void`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:107](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L107)

Logs a message at INFO level.

#### Parameters

##### body

The log message or structured data

`string` | `Record`\<`string`, `unknown`\>

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`

***

### trace()

> **trace**(`body`, `attributes?`): `void`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:91](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L91)

Logs a message at TRACE level.

#### Parameters

##### body

The log message or structured data

`string` | `Record`\<`string`, `unknown`\>

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`

***

### warn()

> **warn**(`body`, `attributes?`): `void`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:115](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L115)

Logs a message at WARN level.

#### Parameters

##### body

The log message or structured data

`string` | `Record`\<`string`, `unknown`\>

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`
