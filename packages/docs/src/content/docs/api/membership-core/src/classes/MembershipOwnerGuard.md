---
editUrl: false
next: false
prev: false
title: "MembershipOwnerGuard"
---

:::caution[Deprecated]
Validation-only owner checks cannot enforce invariants under concurrency. Use
[MembershipStore.mutateOwner](/api/membership-core/src/classes/membershipstore/#mutateowner) or [MembershipStore.transferOwnership](/api/membership-core/src/classes/membershipstore/#transferownership) for writes.
:::

## Constructors

### Constructor

> **new MembershipOwnerGuard**(`store`): `MembershipOwnerGuard`

#### Parameters

##### store

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/)

#### Returns

`MembershipOwnerGuard`

## Methods

### ~~findOwners()~~

> **findOwners**(`tenantId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

***

### ~~isLastOwner()~~

> **isLastOwner**(`tenantId`, `userId`, `currentRole`): `Promise`\<`boolean`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### currentRole

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

#### Returns

`Promise`\<`boolean`\>

***

### ~~validateLastOwner()~~

> **validateLastOwner**(`tenantId`, `userId`, `currentRole`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### currentRole

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

#### Returns

`Promise`\<`void`\>

***

### ~~validateOwnerMutation()~~

> **validateOwnerMutation**(`input`): `Promise`\<`void`\>

#### Parameters

##### input

###### currentRole

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

###### nextRole?

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

###### operation

`"remove"` \| `"demote"`

###### tenantId

`string`

###### userId

`string`

#### Returns

`Promise`\<`void`\>
