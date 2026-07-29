---
editUrl: false
next: false
prev: false
title: "BillingServiceDependencies"
---

> **BillingServiceDependencies** = `object`

BillingService 생성에 필요한 의존성과 체크아웃 입력 타입입니다.

## Properties

### clock?

> `optional` **clock?**: () => `Date`

#### Returns

`Date`

---

### eventPublisher?

> `optional` **eventPublisher?**: [`BillingLifecycleEventPublisher`](/api/billing-core/src/interfaces/billinglifecycleeventpublisher/)

---

### gateway

> **gateway**: [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/)

---

### store

> **store**: [`BillingStore`](/api/billing-core/src/classes/billingstore/)
