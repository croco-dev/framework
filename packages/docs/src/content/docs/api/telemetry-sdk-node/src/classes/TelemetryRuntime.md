---
editUrl: false
next: false
prev: false
title: "TelemetryRuntime"
---

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:8](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/telemetry-sdk-node/src/runtime.ts#L8)

## Methods

### forceFlush()

> **forceFlush**(): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:75](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/telemetry-sdk-node/src/runtime.ts#L75)

#### Returns

`Promise`\<`void`\>

***

### getConfig()

> **getConfig**(): [`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:102](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/telemetry-sdk-node/src/runtime.ts#L102)

#### Returns

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

***

### init()

> **init**(`config`): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:24](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/telemetry-sdk-node/src/runtime.ts#L24)

#### Parameters

##### config

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/)

#### Returns

`Promise`\<`void`\>

***

### isInitialized()

> **isInitialized**(): `boolean`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:98](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/telemetry-sdk-node/src/runtime.ts#L98)

#### Returns

`boolean`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:85](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/telemetry-sdk-node/src/runtime.ts#L85)

#### Returns

`Promise`\<`void`\>

***

### getInstance()

> `static` **getInstance**(): `TelemetryRuntime`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:17](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/telemetry-sdk-node/src/runtime.ts#L17)

#### Returns

`TelemetryRuntime`
