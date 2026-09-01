---
editUrl: false
next: false
prev: false
title: "MembershipStore"
---

멤버십 저장소 인터페이스

## Description

멤버십 데이터 영속성을 위한 추상 인터페이스입니다. 데이터베이스, 인메모리 저장소 등 다양한 구현체가 가능합니다.
지원되는 공개 쓰기 경계는 idempotency key와 recoverable event intent를 함께 처리하는 `execute()`입니다.

## Example

**커스텀 저장소 구현**

```typescript
class PostgresMembershipStore extends MembershipStore {
  async findByTenantAndUser(tenantId: string, userId: string) {
    // DB 조회 로직
  }
  // 다른 메서드 구현...
}
```

## Extended by

- [`DrizzleMembershipStore`](/api/membership-drizzle/src/classes/drizzlemembershipstore/)
- [`InMemoryMembershipStore`](/api/membership-core/src/classes/inmemorymembershipstore/)

## Constructors

### Constructor

> **new MembershipStore**(): `MembershipStore`

#### Returns

`MembershipStore`

## Properties

### eventIntentDurability

> `abstract` `readonly` **eventIntentDurability**: `"persistent"` \| `"volatile"`

## Methods

### countAll()

> `abstract` **countAll**(`tenantId`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`number`\>

---

### countByRole()

> `abstract` **countByRole**(`tenantId`, `role`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

##### role

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

#### Returns

`Promise`\<`number`\>

---

### execute()

> `abstract` **execute**(`command`): `Promise`\<[`MembershipCommandResult`](/api/membership-core/src/type-aliases/membershipcommandresult/)\>

#### Parameters

##### command

[`MembershipCommand`](/api/membership-core/src/type-aliases/membershipcommand/)

#### Returns

`Promise`\<[`MembershipCommandResult`](/api/membership-core/src/type-aliases/membershipcommandresult/)\>

---

### findAllByTenant()

> `abstract` **findAllByTenant**(`tenantId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

---

### findAllByUser()

> `abstract` **findAllByUser**(`userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

---

### findByTenantAndUser()

> `abstract` **findByTenantAndUser**(`tenantId`, `userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/) \| `null`\>

---

### getPendingEventIntent()

> `abstract` **getPendingEventIntent**(`idempotencyKey`): `Promise`\<[`MembershipEventIntent`](/api/membership-core/src/type-aliases/membershipeventintent/) \| `null`\>

#### Parameters

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`MembershipEventIntent`](/api/membership-core/src/type-aliases/membershipeventintent/) \| `null`\>

---

### hasExecutedCommand()

> `abstract` **hasExecutedCommand**(`idempotencyKey`): `Promise`\<`boolean`\>

#### Parameters

##### idempotencyKey

`string`

#### Returns

`Promise`\<`boolean`\>

---

### listPendingEventIntents()

> `abstract` **listPendingEventIntents**(`limit?`): `Promise`\<readonly [`MembershipEventIntent`](/api/membership-core/src/type-aliases/membershipeventintent/)[]\>

#### Parameters

##### limit?

`number`

#### Returns

`Promise`\<readonly [`MembershipEventIntent`](/api/membership-core/src/type-aliases/membershipeventintent/)[]\>

---

### markEventIntentPublished()

> `abstract` **markEventIntentPublished**(`intentId`): `Promise`\<`void`\>

#### Parameters

##### intentId

`string`

#### Returns

`Promise`\<`void`\>
