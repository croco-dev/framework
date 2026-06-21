---
editUrl: false
next: false
prev: false
title: "FrontendTelemetrySink"
---

> **FrontendTelemetrySink** = `object`

브라우저 상호작용과 생성된 RPC 클라이언트 요청을 연결하는 provider-neutral telemetry bridge 타입입니다.

## Properties

### record()

> `readonly` **record**: (`event`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### event

[`FrontendTelemetryEvent`](/api/telemetry-api/src/type-aliases/frontendtelemetryevent/)

#### Returns

`void` \| `Promise`\<`void`\>
