---
editUrl: false
next: false
prev: false
title: "SsrHandlerOptions"
---

> **SsrHandlerOptions** = `object`

SSR 핸들러 옵션

Cloudflare Workers 환경에서 SSR 동작을 제어합니다.

## Properties

### apiBindingName?

> `optional` **apiBindingName?**: `string`

API 서비스 Worker의 바인딩 이름 (기본값: 'API_WORKER')

---

### onFailure?

> `optional` **onFailure?**: [`SsrFailureReporter`](/api/frontend-cloudflare/src/type-aliases/ssrfailurereporter/)

Worker 응답 경로와 분리해 경계 실패를 수집하는 선택적 reporter
