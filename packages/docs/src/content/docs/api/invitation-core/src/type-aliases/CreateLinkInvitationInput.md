---
editUrl: false
next: false
prev: false
title: "CreateLinkInvitationInput"
---

> **CreateLinkInvitationInput** = `object`

초대 생성과 수락에 사용하는 입력 타입입니다.

## Properties

### expiresInDays?

> `optional` **expiresInDays?**: `number`

Positive integer number of calendar days. Fractional days are not supported.

***

### idempotencyKey

> **idempotencyKey**: `string`

***

### inviterId

> **inviterId**: `string`

***

### role

> **role**: [`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

***

### tenantId

> **tenantId**: `string`
