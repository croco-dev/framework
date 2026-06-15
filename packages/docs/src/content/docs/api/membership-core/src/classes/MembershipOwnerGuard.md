---
editUrl: false
next: false
prev: false
title: "MembershipOwnerGuard"
---

멤버십 소유자 변경 가드

## Description

소유자 역할 변경/제거 시 제약 조건을 검증하는 가드 클래스입니다. 마지막 소유자가 제거되거나 강등되지 않도록 보호합니다.

## Example

```typescript
const guard = new MembershipOwnerGuard(store);

await guard.validateOwnerMutation({
  tenantId: 'tenant-1',
  userId: 'user-1',
  currentRole: 'owner',
  operation: 'remove'
});
```

## Constructors

### Constructor

> **new MembershipOwnerGuard**(`store`): `MembershipOwnerGuard`

#### Parameters

##### store

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/)

#### Returns

`MembershipOwnerGuard`

## Methods

### findOwners()

> **findOwners**(`tenantId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

***

### isLastOwner()

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

### validateLastOwner()

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

### validateOwnerMutation()

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
