---
editUrl: false
next: false
prev: false
title: "FrontendTelemetryBridge"
---

> **FrontendTelemetryBridge** = `object`

브라우저 상호작용과 생성된 RPC 클라이언트 요청을 연결하는 provider-neutral telemetry bridge 타입입니다.

## Properties

### correlationId

> `readonly` **correlationId**: `string`

***

### createHeaders()

> `readonly` **createHeaders**: (`context`) => `Record`\<`string`, `string`\>

#### Parameters

##### context

[`FrontendTelemetryRequestContext`](/api/telemetry-api/src/type-aliases/frontendtelemetryrequestcontext/)

#### Returns

`Record`\<`string`, `string`\>

***

### interactionId

> `readonly` **interactionId**: `string`

***

### record()

> `readonly` **record**: (`event`) => `void`

#### Parameters

##### event

[`FrontendTelemetryEvent`](/api/telemetry-api/src/type-aliases/frontendtelemetryevent/)

#### Returns

`void`

***

### traceparent

> `readonly` **traceparent**: `string`
