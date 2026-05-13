---
editUrl: false
next: false
prev: false
title: "Session"
---

> **Session** = `object`

세션 조회와 관리에 사용하는 타입과 공급자 계약입니다.

## Properties

### abandonedAt?

> `optional` **abandonedAt**: `Date`

***

### clientId

> **clientId**: `string`

***

### createdAt

> **createdAt**: `Date`

***

### expireAt?

> `optional` **expireAt**: `Date`

***

### id

> **id**: `string`

***

### lastActiveAt?

> `optional` **lastActiveAt**: `Date`

***

### status

> **status**: `"abandoned"` \| `"active"` \| `"pending"` \| `"ended"` \| `"expired"` \| `"removed"` \| `"replaced"` \| `"revoked"`

***

### updatedAt

> **updatedAt**: `Date`

***

### userId

> **userId**: `string`
