---
editUrl: false
next: false
prev: false
title: "RateLimitDecoratorOptions"
---

> **RateLimitDecoratorOptions** = `object`

메서드에 레이트 리밋 정책을 선언하는 데코레이터와 옵션 타입입니다.

## Properties

### algorithm?

> `optional` **algorithm**: [`RateLimitAlgorithm`](/api/ratelimit-core/src/type-aliases/ratelimitalgorithm/)

---

### key()?

> `optional` **key**: (`context`) => `string`

#### Parameters

##### context

`unknown`

#### Returns

`string`

---

### limit?

> `optional` **limit**: `number`

---

### policy?

> `optional` **policy**: `string`

---

### window?

> `optional` **window**: `string`
