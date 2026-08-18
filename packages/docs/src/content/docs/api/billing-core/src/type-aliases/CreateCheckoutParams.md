---
editUrl: false
next: false
prev: false
title: "CreateCheckoutParams"
---

> **CreateCheckoutParams** = `object`

외부 결제 제공자 연동 계약과 체크아웃 관련 타입입니다.

## Properties

### billingAccountId

> **billingAccountId**: `string`

---

### cancelUrl?

> `optional` **cancelUrl?**: `string`

---

### email

> **email**: `string`

---

### idempotencyKey

> **idempotencyKey**: `string`

Stable identity for one logical checkout operation.
Gateway implementations must reconcile retries with the same key to the same provider session.

---

### productId

> **productId**: `string`

---

### successUrl

> **successUrl**: `string`
