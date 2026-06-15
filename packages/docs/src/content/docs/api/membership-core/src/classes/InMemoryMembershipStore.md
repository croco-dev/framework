---
editUrl: false
next: false
prev: false
title: "InMemoryMembershipStore"
---

인메모리 멤버십 저장소 구현체

## Description

[MembershipStore](/api/membership-core/src/classes/membershipstore/) 인터페이스의 인메모리 구현체입니다. 테스트 및 프로토타이핑에 적합합니다.

## Example

```typescript
import { InMemoryMembershipStore } from '@croco/membership-core';

const store = new InMemoryMembershipStore();
const membership = await store.save({
  id: 'mem-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'admin'
});
```

## Extends

- [`MembershipStore`](/api/membership-core/src/classes/membershipstore/)

## Constructors

### Constructor

> **new InMemoryMembershipStore**(): `InMemoryMembershipStore`

#### Returns

`InMemoryMembershipStore`

#### Inherited from

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`constructor`](/api/membership-core/src/classes/membershipstore/#constructor)

## Methods

### countAll()

> **countAll**(`tenantId`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`number`\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`countAll`](/api/membership-core/src/classes/membershipstore/#countall)

***

### countByRole()

> **countByRole**(`tenantId`, `role`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

##### role

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

#### Returns

`Promise`\<`number`\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`countByRole`](/api/membership-core/src/classes/membershipstore/#countbyrole)

***

### delete()

> **delete**(`tenantId`, `userId`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`delete`](/api/membership-core/src/classes/membershipstore/#delete)

***

### findAllByTenant()

> **findAllByTenant**(`tenantId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`findAllByTenant`](/api/membership-core/src/classes/membershipstore/#findallbytenant)

***

### findAllByUser()

> **findAllByUser**(`userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`findAllByUser`](/api/membership-core/src/classes/membershipstore/#findallbyuser)

***

### findByTenantAndUser()

> **findByTenantAndUser**(`tenantId`, `userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`findByTenantAndUser`](/api/membership-core/src/classes/membershipstore/#findbytenantanduser)

***

### save()

> **save**(`input`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Parameters

##### input

[`MembershipCreateInput`](/api/membership-core/src/type-aliases/membershipcreateinput/)

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`save`](/api/membership-core/src/classes/membershipstore/#save)
