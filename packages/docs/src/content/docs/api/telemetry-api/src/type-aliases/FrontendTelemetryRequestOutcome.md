---
editUrl: false
next: false
prev: false
title: "FrontendTelemetryRequestOutcome"
---

> **FrontendTelemetryRequestOutcome** = `object`

브라우저 상호작용과 생성된 RPC 클라이언트 요청을 연결하는 provider-neutral telemetry bridge 타입입니다.

## Properties

### errorName?

> `readonly` `optional` **errorName?**: `string`

---

### kind

> `readonly` **kind**: `"succeeded"` \| `"problem"` \| `"external_failure"` \| `"cancelled"`

---

### problem?

> `readonly` `optional` **problem?**: [`FrontendTelemetryProblemSummary`](/api/telemetry-api/src/type-aliases/frontendtelemetryproblemsummary/)

---

### status?

> `readonly` `optional` **status?**: `number`
