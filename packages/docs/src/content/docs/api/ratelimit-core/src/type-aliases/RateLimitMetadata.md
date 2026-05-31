---
editUrl: false
next: false
prev: false
title: "RateLimitMetadata"
---

> **RateLimitMetadata** = `object`

라우트 실행 시 레이트 리밋을 검사하는 가드와 메타데이터 타입입니다.

## Properties

### customKey()?

> `optional` **customKey**: (`context`) => `string`

#### Parameters

##### context

`unknown`

#### Returns

`string`

---

### policy

> **policy**: [`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)
