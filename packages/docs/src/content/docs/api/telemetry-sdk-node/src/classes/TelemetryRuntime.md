---
editUrl: false
next: false
prev: false
title: "TelemetryRuntime"
---

## Methods

### forceFlush()

> **forceFlush**(`timeoutMillis?`): `Promise`\<[`ForceFlushResult`](/api/telemetry-sdk-node/src/type-aliases/forceflushresult/)\>

#### Parameters

##### timeoutMillis?

`number`

#### Returns

`Promise`\<[`ForceFlushResult`](/api/telemetry-sdk-node/src/type-aliases/forceflushresult/)\>

***

### getConfig()

> **getConfig**(): [`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

#### Returns

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

***

### getEnabledAutoInstrumentationModules()

> **getEnabledAutoInstrumentationModules**(): `string`[]

#### Returns

`string`[]

***

### init()

> **init**(`config`): `Promise`\<`void`\>

#### Parameters

##### config

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/)

#### Returns

`Promise`\<`void`\>

***

### isEnabled()

> **isEnabled**(): `boolean`

#### Returns

`boolean`

***

### isInitialized()

> **isInitialized**(): `boolean`

#### Returns

`boolean`

***

### shutdown()

> **shutdown**(): `Promise`\<[`ShutdownResult`](/api/telemetry-sdk-node/src/type-aliases/shutdownresult/)\>

#### Returns

`Promise`\<[`ShutdownResult`](/api/telemetry-sdk-node/src/type-aliases/shutdownresult/)\>

***

### getInstance()

> `static` **getInstance**(): `TelemetryRuntime`

#### Returns

`TelemetryRuntime`

***

### reset()

> `static` **reset**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
