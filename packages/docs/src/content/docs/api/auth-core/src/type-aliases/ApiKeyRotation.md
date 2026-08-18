---
editUrl: false
next: false
prev: false
title: "ApiKeyRotation"
---

> **ApiKeyRotation** = `object`

API 키 도메인 모델과 생성 관련 타입입니다.

## Properties

### createdAt

> **createdAt**: `Date`

***

### eventClaimExpiresAt

> **eventClaimExpiresAt**: `Date` \| `null`

***

### eventClaimId

> **eventClaimId**: `string` \| `null`

***

### eventId

> **eventId**: `string`

***

### eventOccurredAt

> **eventOccurredAt**: `Date`

***

### eventStatus

> **eventStatus**: [`ApiKeyRotationPhaseStatus`](/api/auth-core/src/type-aliases/apikeyrotationphasestatus/)

***

### idempotencyKey

> **idempotencyKey**: `string`

***

### oldKeyId

> **oldKeyId**: `string`

***

### recoveryCiphertext

> **recoveryCiphertext**: `string`

***

### replacement

> **replacement**: [`ApiKey`](/api/auth-core/src/type-aliases/apikey/)

***

### tenantId

> **tenantId**: `string`
