---
editUrl: false
next: false
prev: false
title: "MembershipStore"
---

멤버십 저장소 인터페이스

## Description

멤버십 데이터 영속성을 위한 추상 인터페이스입니다. 데이터베이스, 인메모리 저장소 등 다양한 구현체가 가능합니다.

## Example

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

## Methods

### countAll()

> `abstract` **countAll**(`tenantId`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`number`\>

***

### countByRole()

> `abstract` **countByRole**(`tenantId`, `role`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

##### role

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

#### Returns

`Promise`\<`number`\>

***

### delete()

> `abstract` **delete**(`tenantId`, `userId`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

#### Returns

`Promise`\<`void`\>

***

### findAllByTenant()

> `abstract` **findAllByTenant**(`tenantId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

***

### findAllByUser()

> `abstract` **findAllByUser**(`userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

***

### findByTenantAndUser()

> `abstract` **findByTenantAndUser**(`tenantId`, `userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/) \| `null`\>

***

### save()

> `abstract` **save**(`input`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Parameters

##### input

###### id

`string`

###### role

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

###### tenantId

`string`

###### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>
