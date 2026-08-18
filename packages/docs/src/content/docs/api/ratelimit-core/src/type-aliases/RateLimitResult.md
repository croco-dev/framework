---
editUrl: false
next: false
prev: false
title: "RateLimitResult"
---

> **RateLimitResult** = `object`

정책, 결과, 통계, 타입 가드에 사용하는 핵심 타입과 유틸리티입니다.

## Properties

### degraded?

> `optional` **degraded?**: `boolean`

---

### limit

> **limit**: `number`

---

### policyName?

> `optional` **policyName?**: `string`

---

### refundReceipt?

> `optional` **refundReceipt?**: [`RateLimitRefundReceipt`](/api/ratelimit-core/src/type-aliases/ratelimitrefundreceipt/)

---

### remaining

> **remaining**: `number`

---

### resetAtMs

> **resetAtMs**: `number`

---

### success

> **success**: `boolean`
