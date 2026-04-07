---
editUrl: false
next: false
prev: false
title: "TelemetryRuntime"
---

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:13](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/runtime.ts#L13)

## Methods

### forceFlush()

> **forceFlush**(`timeoutMillis?`): `Promise`\<[`ForceFlushResult`](/api/telemetry-sdk-node/src/type-aliases/forceflushresult/)\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:120](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/runtime.ts#L120)

#### Parameters

##### timeoutMillis?

`number`

#### Returns

`Promise`\<[`ForceFlushResult`](/api/telemetry-sdk-node/src/type-aliases/forceflushresult/)\>

***

### getConfig()

> **getConfig**(): [`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:180](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/runtime.ts#L180)

#### Returns

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

***

### init()

> **init**(`config`): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:49](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/runtime.ts#L49)

#### Parameters

##### config

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/)

#### Returns

`Promise`\<`void`\>

***

### isInitialized()

> **isInitialized**(): `boolean`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:176](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/runtime.ts#L176)

#### Returns

`boolean`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:153](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/runtime.ts#L153)

#### Returns

`Promise`\<`void`\>

***

### getInstance()

> `static` **getInstance**(): `TelemetryRuntime`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:42](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/runtime.ts#L42)

#### Returns

`TelemetryRuntime`

***

### reset()

> `static` **reset**(): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:168](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/runtime.ts#L168)

#### Returns

`Promise`\<`void`\>
