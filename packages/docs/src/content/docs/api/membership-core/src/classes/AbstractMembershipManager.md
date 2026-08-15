---
editUrl: false
next: false
prev: false
title: "AbstractMembershipManager"
---

멤버십 매니저 추상 인터페이스

## Description

멤버십 관리 기능의 추상 인터페이스입니다.

## Constructors

### Constructor

> **new AbstractMembershipManager**(): `MembershipManager`

#### Returns

`MembershipManager`

## Methods

### addMember()

> `abstract` **addMember**(`tenantId`, `userId`, `role`, `idempotencyKey`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### role

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

---

### addMemberCommand()

> `abstract` **addMemberCommand**(`tenantId`, `userId`, `role`, `idempotencyKey`): `Promise`\<\{ `membership`: [`Membership`](/api/membership-core/src/type-aliases/membership/); `operation`: `"add"`; `replayed`: `boolean`; \}\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### role

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

##### idempotencyKey

`string`

#### Returns

`Promise`\<\{ `membership`: [`Membership`](/api/membership-core/src/type-aliases/membership/); `operation`: `"add"`; `replayed`: `boolean`; \}\>

---

### getMember()

> `abstract` **getMember**(`tenantId`, `userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

---

### listMembers()

> `abstract` **listMembers**(`tenantId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

---

### listTenants()

> `abstract` **listTenants**(`userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

---

### publishPendingEvents()

> `abstract` **publishPendingEvents**(`limit?`): `Promise`\<`number`\>

#### Parameters

##### limit?

`number`

#### Returns

`Promise`\<`number`\>

---

### removeMember()

> `abstract` **removeMember**(`tenantId`, `userId`, `idempotencyKey`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`void`\>

---

### transferOwnership()

> `abstract` **transferOwnership**(`tenantId`, `fromUserId`, `toUserId`, `idempotencyKey`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### fromUserId

`string`

##### toUserId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`void`\>

---

### updateRole()

> `abstract` **updateRole**(`tenantId`, `userId`, `newRole`, `idempotencyKey`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### newRole

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>
