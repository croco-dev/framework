---
editUrl: false
next: false
prev: false
title: "InMemoryInvitationStore"
---

테스트와 로컬 개발용 인메모리 초대 저장소입니다.

## Extends

- [`InvitationStore`](/api/invitation-core/src/classes/invitationstore/)

## Constructors

### Constructor

> **new InMemoryInvitationStore**(): `InMemoryInvitationStore`

#### Returns

`InMemoryInvitationStore`

#### Inherited from

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`constructor`](/api/invitation-core/src/classes/invitationstore/#constructor)

## Methods

### compareAndSetStatus()

> **compareAndSetStatus**(`tenantId`, `id`, `expected`, `desired`, `meta?`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### tenantId

`string`

##### id

`string`

##### expected

[`InvitationStatus`](/api/invitation-core/src/type-aliases/invitationstatus/)

##### desired

[`InvitationStatus`](/api/invitation-core/src/type-aliases/invitationstatus/)

##### meta?

###### acceptedAt?

`Date`

###### rejectedAt?

`Date`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`compareAndSetStatus`](/api/invitation-core/src/classes/invitationstore/#compareandsetstatus)

***

### countPendingByTenant()

> **countPendingByTenant**(`tenantId`, `since`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

##### since

`Date`

#### Returns

`Promise`\<`number`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`countPendingByTenant`](/api/invitation-core/src/classes/invitationstore/#countpendingbytenant)

***

### findAllByTenant()

> **findAllByTenant**(`tenantId`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)[]\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`findAllByTenant`](/api/invitation-core/src/classes/invitationstore/#findallbytenant)

***

### findById()

> **findById**(`id`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`findById`](/api/invitation-core/src/classes/invitationstore/#findbyid)

***

### findByTenantAndEmail()

> **findByTenantAndEmail**(`tenantId`, `email`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### tenantId

`string`

##### email

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`findByTenantAndEmail`](/api/invitation-core/src/classes/invitationstore/#findbytenantandemail)

***

### findByTokenHash()

> **findByTokenHash**(`tokenHash`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### tokenHash

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`findByTokenHash`](/api/invitation-core/src/classes/invitationstore/#findbytokenhash)

***

### save()

> **save**(`invitation`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### invitation

[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`save`](/api/invitation-core/src/classes/invitationstore/#save)

***

### updateStatus()

> **updateStatus**(`tenantId`, `id`, `status`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### tenantId

`string`

##### id

`string`

##### status

[`InvitationStatus`](/api/invitation-core/src/type-aliases/invitationstatus/)

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`updateStatus`](/api/invitation-core/src/classes/invitationstore/#updatestatus)
