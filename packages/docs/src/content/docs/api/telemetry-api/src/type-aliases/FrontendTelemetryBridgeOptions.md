---
editUrl: false
next: false
prev: false
title: "FrontendTelemetryBridgeOptions"
---

> **FrontendTelemetryBridgeOptions** = `object`

브라우저 상호작용과 생성된 RPC 클라이언트 요청을 연결하는 provider-neutral telemetry bridge 타입입니다.

## Properties

### allowedOrigins?

> `readonly` `optional` **allowedOrigins?**: readonly `string`[]

---

### correlationId?

> `readonly` `optional` **correlationId?**: `string`

---

### headerNames?

> `readonly` `optional` **headerNames?**: [`FrontendTelemetryHeaderNames`](/api/telemetry-api/src/type-aliases/frontendtelemetryheadernames/)

---

### interactionId?

> `readonly` `optional` **interactionId?**: `string`

---

### sink?

> `readonly` `optional` **sink?**: [`FrontendTelemetrySink`](/api/telemetry-api/src/type-aliases/frontendtelemetrysink/)

---

### spanMode?

> `readonly` `optional` **spanMode?**: [`FrontendTelemetrySpanMode`](/api/telemetry-api/src/type-aliases/frontendtelemetryspanmode/)

---

### traceparent?

> `readonly` `optional` **traceparent?**: `string`

---

### tracestate?

> `readonly` `optional` **tracestate?**: `string`
