---
editUrl: false
next: false
prev: false
title: "DomainPolicyStore"
---

도메인 정책 저장소 추상 계약입니다.

## Extended by

- [`InMemoryDomainPolicyStore`](/api/invitation-core/src/classes/inmemorydomainpolicystore/)

## Constructors

### Constructor

> **new DomainPolicyStore**(): `DomainPolicyStore`

#### Returns

`DomainPolicyStore`

## Methods

### delete()

> `abstract` **delete**(`tenantId`, `domain`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### domain

`string`

#### Returns

`Promise`\<`void`\>

***

### findAllByTenant()

> `abstract` **findAllByTenant**(`tenantId`): `Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)[]\>

***

### findByTenantAndDomain()

> `abstract` **findByTenantAndDomain**(`tenantId`, `domain`): `Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)\>

#### Parameters

##### tenantId

`string`

##### domain

`string`

#### Returns

`Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)\>

***

### save()

> `abstract` **save**(`policy`): `Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)\>

#### Parameters

##### policy

[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)

#### Returns

`Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)\>
