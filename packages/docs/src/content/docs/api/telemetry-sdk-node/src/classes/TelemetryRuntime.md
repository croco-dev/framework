---
editUrl: false
next: false
prev: false
title: "TelemetryRuntime"
---

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:13](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/runtime.ts#L13)

OpenTelemetry SDK를 초기화하고 flush, shutdown을 관리하는 런타임 싱글턴입니다.

## Methods

### forceFlush()

> **forceFlush**(`timeoutMillis?`): `Promise`\<[`ForceFlushResult`](/api/telemetry-sdk-node/src/type-aliases/forceflushresult/)\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:117](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/runtime.ts#L117)

#### Parameters

##### timeoutMillis?

`number`

#### Returns

`Promise`\<[`ForceFlushResult`](/api/telemetry-sdk-node/src/type-aliases/forceflushresult/)\>

***

### getConfig()

> **getConfig**(): [`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:186](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/runtime.ts#L186)

#### Returns

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

***

### init()

> **init**(`config`): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:46](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/runtime.ts#L46)

#### Parameters

##### config

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/)

#### Returns

`Promise`\<`void`\>

***

### isInitialized()

> **isInitialized**(): `boolean`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:182](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/runtime.ts#L182)

#### Returns

`boolean`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:159](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/runtime.ts#L159)

#### Returns

`Promise`\<`void`\>

***

### getInstance()

> `static` **getInstance**(): `TelemetryRuntime`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:39](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/runtime.ts#L39)

#### Returns

`TelemetryRuntime`

***

### reset()

> `static` **reset**(): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:174](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/runtime.ts#L174)

#### Returns

`Promise`\<`void`\>
