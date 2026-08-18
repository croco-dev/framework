---
editUrl: false
next: false
prev: false
title: "FrontendTelemetryRequestContext"
---

> **FrontendTelemetryRequestContext** = `object`

브라우저 상호작용과 생성된 RPC 클라이언트 요청을 연결하는 provider-neutral telemetry bridge 타입입니다.

## Properties

### attempt?

> `readonly` `optional` **attempt?**: `number`

---

### correlationId?

> `readonly` `optional` **correlationId?**: `string`

---

### interactionId?

> `readonly` `optional` **interactionId?**: `string`

---

### method

> `readonly` **method**: `string`

---

### methodName

> `readonly` **methodName**: `string`

---

### operationId

> `readonly` **operationId**: `string`

---

### path

> `readonly` **path**: `string`

---

### routeId

> `readonly` **routeId**: `string`

---

### routeKind

> `readonly` **routeKind**: [`FrontendTelemetryRouteKind`](/api/telemetry-api/src/type-aliases/frontendtelemetryroutekind/)

---

### traceparent?

> `readonly` `optional` **traceparent?**: `string`
