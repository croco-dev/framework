---
editUrl: false
next: false
prev: false
title: "Logger"
---

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

Logs a message at DEBUG level.

#### Parameters

##### body

`string` \| `Record`\<`string`, `unknown`\>

The log message or structured data

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`

***

### emit()

> **emit**(`options`): `void`

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

Logs a message at ERROR level.

#### Parameters

##### body

`string` \| `Record`\<`string`, `unknown`\>

The log message or structured data

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`

***

### fatal()

> **fatal**(`body`, `attributes?`): `void`

Logs a message at FATAL level.

#### Parameters

##### body

`string` \| `Record`\<`string`, `unknown`\>

The log message or structured data

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`

***

### info()

> **info**(`body`, `attributes?`): `void`

Logs a message at INFO level.

#### Parameters

##### body

`string` \| `Record`\<`string`, `unknown`\>

The log message or structured data

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`

***

### trace()

> **trace**(`body`, `attributes?`): `void`

Logs a message at TRACE level.

#### Parameters

##### body

`string` \| `Record`\<`string`, `unknown`\>

The log message or structured data

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`

***

### warn()

> **warn**(`body`, `attributes?`): `void`

Logs a message at WARN level.

#### Parameters

##### body

`string` \| `Record`\<`string`, `unknown`\>

The log message or structured data

##### attributes?

`Attributes`

Additional attributes

#### Returns

`void`
