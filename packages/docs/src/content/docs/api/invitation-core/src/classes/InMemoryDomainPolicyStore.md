---
editUrl: false
next: false
prev: false
title: "InMemoryDomainPolicyStore"
---

테스트와 로컬 개발용 인메모리 도메인 정책 저장소입니다.

## Extends

- [`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/)

## Constructors

### Constructor

> **new InMemoryDomainPolicyStore**(): `InMemoryDomainPolicyStore`

#### Returns

`InMemoryDomainPolicyStore`

#### Inherited from

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`constructor`](/api/invitation-core/src/classes/domainpolicystore/#constructor)

## Methods

### delete()

> **delete**(`tenantId`, `domain`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### domain

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`delete`](/api/invitation-core/src/classes/domainpolicystore/#delete)

***

### findAllByTenant()

> **findAllByTenant**(`tenantId`): `Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)[]\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`findAllByTenant`](/api/invitation-core/src/classes/domainpolicystore/#findallbytenant)

***

### findByTenantAndDomain()

> **findByTenantAndDomain**(`tenantId`, `domain`): `Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### domain

`string`

#### Returns

`Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/) \| `null`\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`findByTenantAndDomain`](/api/invitation-core/src/classes/domainpolicystore/#findbytenantanddomain)

***

### save()

> **save**(`policy`): `Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)\>

#### Parameters

##### policy

[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)

#### Returns

`Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`save`](/api/invitation-core/src/classes/domainpolicystore/#save)
