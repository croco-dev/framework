---
editUrl: false
next: false
prev: false
title: "FrontendTelemetryEvent"
---

> **FrontendTelemetryEvent** = [`FrontendTelemetryRequestContext`](/api/telemetry-api/src/type-aliases/frontendtelemetryrequestcontext/) & `object`

브라우저 상호작용과 생성된 RPC 클라이언트 요청을 연결하는 provider-neutral telemetry bridge 타입입니다.

## Type Declaration

### durationMs?

> `readonly` `optional` **durationMs**: `number`

### errorMessage?

> `readonly` `optional` **errorMessage**: `string`

### errorName?

> `readonly` `optional` **errorName**: `string`

### kind

> `readonly` **kind**: [`FrontendTelemetryEventKind`](/api/telemetry-api/src/type-aliases/frontendtelemetryeventkind/)

### problem?

> `readonly` `optional` **problem**: [`FrontendTelemetryProblemSummary`](/api/telemetry-api/src/type-aliases/frontendtelemetryproblemsummary/)

### status?

> `readonly` `optional` **status**: `number`

### timestamp

> `readonly` **timestamp**: `number`
