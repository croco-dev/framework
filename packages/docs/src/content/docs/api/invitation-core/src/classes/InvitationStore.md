---
editUrl: false
next: false
prev: false
title: "InvitationStore"
---

초대 저장소 추상 계약입니다.

## Extended by

- [`InMemoryInvitationStore`](/api/invitation-core/src/classes/inmemoryinvitationstore/)

## Constructors

### Constructor

> **new InvitationStore**(): `InvitationStore`

#### Returns

`InvitationStore`

## Methods

### compareAndSetStatus()

> `abstract` **compareAndSetStatus**(`tenantId`, `id`, `expected`, `desired`, `meta?`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

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

***

### countPendingByTenant()

> `abstract` **countPendingByTenant**(`tenantId`, `since`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

##### since

`Date`

#### Returns

`Promise`\<`number`\>

***

### findAllByTenant()

> `abstract` **findAllByTenant**(`tenantId`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)[]\>

***

### findById()

> `abstract` **findById**(`id`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

***

### findByTenantAndEmail()

> `abstract` **findByTenantAndEmail**(`tenantId`, `email`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### tenantId

`string`

##### email

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

***

### findByTokenHash()

> `abstract` **findByTokenHash**(`tokenHash`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### tokenHash

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

***

### save()

> `abstract` **save**(`invitation`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### invitation

[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

***

### updateStatus()

> `abstract` **updateStatus**(`tenantId`, `id`, `status`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### tenantId

`string`

##### id

`string`

##### status

[`InvitationStatus`](/api/invitation-core/src/type-aliases/invitationstatus/)

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>
