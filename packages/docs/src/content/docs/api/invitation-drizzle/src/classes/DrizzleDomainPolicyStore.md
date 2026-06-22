---
editUrl: false
next: false
prev: false
title: "DrizzleDomainPolicyStore"
---

도메인 정책 엔터티를 Drizzle로 저장하고 조회하는 구현체입니다.

## Extends

- [`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/)

## Constructors

### Constructor

> **new DrizzleDomainPolicyStore**(`db`, `txManager`): `DrizzleDomainPolicyStore`

Drizzle 클라이언트와 트랜잭션 매니저를 받아 저장소를 초기화합니다.

#### Parameters

##### db

[`DrizzleDomainPolicyClient`](/api/invitation-drizzle/src/type-aliases/drizzledomainpolicyclient/)

##### txManager

[`TxManager`](/api/tx-core/src/classes/txmanager/)\<[`DrizzleDomainPolicyClient`](/api/invitation-drizzle/src/type-aliases/drizzledomainpolicyclient/)\>

#### Returns

`DrizzleDomainPolicyStore`

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`constructor`](/api/invitation-core/src/classes/domainpolicystore/#constructor)

## Methods

### delete()

> **delete**(`tenantId`, `domain`): `Promise`\<`void`\>

테넌트와 도메인 조합의 정책을 삭제합니다.

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

테넌트의 모든 도메인 정책을 조회합니다.

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

테넌트와 도메인 조합으로 정책을 조회합니다.

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

도메인 정책을 upsert 방식으로 저장합니다.

#### Parameters

##### policy

[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)

#### Returns

`Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`save`](/api/invitation-core/src/classes/domainpolicystore/#save)
