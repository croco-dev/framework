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

### claimAutoJoinEvent()

> **claimAutoJoinEvent**(`tenantId`, `idempotencyKey`, `claimId`, `claimExpiresAt`): `Promise`\<[`DomainAutoJoinIntent`](/api/invitation-core/src/type-aliases/domainautojoinintent/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

##### claimExpiresAt

`Date`

#### Returns

`Promise`\<[`DomainAutoJoinIntent`](/api/invitation-core/src/type-aliases/domainautojoinintent/) \| `null`\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`claimAutoJoinEvent`](/api/invitation-core/src/classes/domainpolicystore/#claimautojoinevent)

---

### completeAutoJoinEvent()

> **completeAutoJoinEvent**(`tenantId`, `idempotencyKey`, `claimId`): `Promise`\<[`DomainAutoJoinIntent`](/api/invitation-core/src/type-aliases/domainautojoinintent/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<[`DomainAutoJoinIntent`](/api/invitation-core/src/type-aliases/domainautojoinintent/) \| `null`\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`completeAutoJoinEvent`](/api/invitation-core/src/classes/domainpolicystore/#completeautojoinevent)

---

### completeAutoJoinMembership()

> **completeAutoJoinMembership**(`tenantId`, `idempotencyKey`, `membership`): `Promise`\<[`DomainAutoJoinIntent`](/api/invitation-core/src/type-aliases/domainautojoinintent/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### membership

[`Membership`](/api/membership-core/src/type-aliases/membership/)

#### Returns

`Promise`\<[`DomainAutoJoinIntent`](/api/invitation-core/src/type-aliases/domainautojoinintent/) \| `null`\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`completeAutoJoinMembership`](/api/invitation-core/src/classes/domainpolicystore/#completeautojoinmembership)

---

### createAutoJoinIntent()

> **createAutoJoinIntent**(`input`): `Promise`\<[`DomainAutoJoinIntentCreation`](/api/invitation-core/src/type-aliases/domainautojoinintentcreation/)\>

#### Parameters

##### input

[`DomainAutoJoinIntent`](/api/invitation-core/src/type-aliases/domainautojoinintent/)

#### Returns

`Promise`\<[`DomainAutoJoinIntentCreation`](/api/invitation-core/src/type-aliases/domainautojoinintentcreation/)\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`createAutoJoinIntent`](/api/invitation-core/src/classes/domainpolicystore/#createautojoinintent)

---

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

---

### deleteUncommittedAutoJoinIntent()

> **deleteUncommittedAutoJoinIntent**(`tenantId`, `idempotencyKey`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`deleteUncommittedAutoJoinIntent`](/api/invitation-core/src/classes/domainpolicystore/#deleteuncommittedautojoinintent)

---

### findAllByTenant()

> **findAllByTenant**(`tenantId`): `Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)[]\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`findAllByTenant`](/api/invitation-core/src/classes/domainpolicystore/#findallbytenant)

---

### findAutoJoinIntent()

> **findAutoJoinIntent**(`tenantId`, `idempotencyKey`): `Promise`\<[`DomainAutoJoinIntent`](/api/invitation-core/src/type-aliases/domainautojoinintent/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`DomainAutoJoinIntent`](/api/invitation-core/src/type-aliases/domainautojoinintent/) \| `null`\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`findAutoJoinIntent`](/api/invitation-core/src/classes/domainpolicystore/#findautojoinintent)

---

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

---

### releaseAutoJoinEvent()

> **releaseAutoJoinEvent**(`tenantId`, `idempotencyKey`, `claimId`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`releaseAutoJoinEvent`](/api/invitation-core/src/classes/domainpolicystore/#releaseautojoinevent)

---

### save()

> **save**(`policy`): `Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)\>

#### Parameters

##### policy

[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)

#### Returns

`Promise`\<[`DomainPolicy`](/api/invitation-core/src/type-aliases/domainpolicy/)\>

#### Overrides

[`DomainPolicyStore`](/api/invitation-core/src/classes/domainpolicystore/).[`save`](/api/invitation-core/src/classes/domainpolicystore/#save)
