---
editUrl: false
next: false
prev: false
title: "DomainPolicyManager"
---

이메일 도메인 자동 가입 정책을 관리하는 매니저입니다.

## Constructors

### Constructor

> **new DomainPolicyManager**(`store`, `membershipManager`, `eventPublisher`): `DomainPolicyManager`

#### Parameters

##### store

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/)

##### membershipManager

[`MembershipManager`](/api/membership-core/src/classes/membershipmanager/)

##### eventPublisher

[`EventPublisher`](/api/events-core/src/classes/eventpublisher/)

#### Returns

`DomainPolicyManager`

## Methods

### addDomainPolicy()

> **addDomainPolicy**(`tenantId`, `domain`, `role`): `Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)\>

#### Parameters

##### tenantId

`string`

##### domain

`string`

##### role

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

#### Returns

`Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)\>

***

### listDomainPolicies()

> **listDomainPolicies**(`tenantId`): `Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)[]\>

***

### removeDomainPolicy()

> **removeDomainPolicy**(`tenantId`, `domain`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### domain

`string`

#### Returns

`Promise`\<`void`\>

***

### tryAutoJoin()

> **tryAutoJoin**(`tenantId`, `userId`, `email`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### email

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/) \| `null`\>
