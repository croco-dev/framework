---
editUrl: false
next: false
prev: false
title: "FrontendTelemetryRequestLifecycle"
---

> **FrontendTelemetryRequestLifecycle** = `object`

브라우저 상호작용과 생성된 RPC 클라이언트 요청을 연결하는 provider-neutral telemetry bridge 타입입니다.

## Properties

### end

> `readonly` **end**: (`outcome`) => `void`

#### Parameters

##### outcome

[`FrontendTelemetryRequestOutcome`](/api/telemetry-api/src/type-aliases/frontendtelemetryrequestoutcome/)

#### Returns

`void`

---

### headers

> `readonly` **headers**: `Record`\<`string`, `string`\>

---

### propagationHeaderNames

> `readonly` **propagationHeaderNames**: readonly `string`[]

---

### run

> `readonly` **run**: \<`T`\>(`operation`) => `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### operation

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

---

### traceparent?

> `readonly` `optional` **traceparent?**: `string`

---

### tracestate?

> `readonly` `optional` **tracestate?**: `string`
