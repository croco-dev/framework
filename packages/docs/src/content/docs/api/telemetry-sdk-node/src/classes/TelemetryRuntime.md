---
editUrl: false
next: false
prev: false
title: "TelemetryRuntime"
---

OpenTelemetry SDK를 초기화하고 flush, shutdown을 관리하는 런타임 싱글턴입니다.

## Methods

### forceFlush()

> **forceFlush**(`timeoutMillis?`): `Promise`\<[`ForceFlushResult`](/api/telemetry-sdk-node/src/type-aliases/forceflushresult/)\>

#### Parameters

##### timeoutMillis?

`number`

#### Returns

`Promise`\<[`ForceFlushResult`](/api/telemetry-sdk-node/src/type-aliases/forceflushresult/)\>

---

### getConfig()

> **getConfig**(): [`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/)

#### Returns

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/)

---

### init()

> **init**(`config`): `Promise`\<`void`\>

#### Parameters

##### config

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/)

#### Returns

`Promise`\<`void`\>

---

### isInitialized()

> **isInitialized**(): `boolean`

#### Returns

`boolean`

---

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

---

### getInstance()

> `static` **getInstance**(): `TelemetryRuntime`

#### Returns

`TelemetryRuntime`

---

### reset()

> `static` **reset**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
