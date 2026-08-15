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

**저장소 생성 및 사용**

```typescript
import { InMemoryMembershipStore } from "@croco/membership-core";

const store = new InMemoryMembershipStore();
const membership = await store.save({
  id: "mem-1",
  tenantId: "tenant-1",
  userId: "user-1",
  role: "admin",
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

## Properties

### eventIntentDurability

> `readonly` **eventIntentDurability**: `"volatile"`

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`eventIntentDurability`](/api/membership-core/src/classes/membershipstore/#eventintentdurability)

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

---

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

---

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

---

### execute()

> **execute**(`command`): `Promise`\<[`MembershipCommandResult`](/api/membership-core/src/type-aliases/membershipcommandresult/)\>

#### Parameters

##### command

[`MembershipCommand`](/api/membership-core/src/type-aliases/membershipcommand/)

#### Returns

`Promise`\<[`MembershipCommandResult`](/api/membership-core/src/type-aliases/membershipcommandresult/)\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`execute`](/api/membership-core/src/classes/membershipstore/#execute)

---

### findAllByTenant()

> **findAllByTenant**(`tenantId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`findAllByTenant`](/api/membership-core/src/classes/membershipstore/#findallbytenant)

---

### findAllByUser()

> **findAllByUser**(`userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`findAllByUser`](/api/membership-core/src/classes/membershipstore/#findallbyuser)

---

### findByTenantAndUser()

> **findByTenantAndUser**(`tenantId`, `userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/) \| `null`\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`findByTenantAndUser`](/api/membership-core/src/classes/membershipstore/#findbytenantanduser)

---

### getPendingEventIntent()

> **getPendingEventIntent**(`idempotencyKey`): `Promise`\<[`MembershipEventIntent`](/api/membership-core/src/type-aliases/membershipeventintent/) \| `null`\>

#### Parameters

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`MembershipEventIntent`](/api/membership-core/src/type-aliases/membershipeventintent/) \| `null`\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`getPendingEventIntent`](/api/membership-core/src/classes/membershipstore/#getpendingeventintent)

---

### hasExecutedCommand()

> **hasExecutedCommand**(`idempotencyKey`): `Promise`\<`boolean`\>

#### Parameters

##### idempotencyKey

`string`

#### Returns

`Promise`\<`boolean`\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`hasExecutedCommand`](/api/membership-core/src/classes/membershipstore/#hasexecutedcommand)

---

### listPendingEventIntents()

> **listPendingEventIntents**(`limit?`): `Promise`\<readonly [`MembershipEventIntent`](/api/membership-core/src/type-aliases/membershipeventintent/)[]\>

#### Parameters

##### limit?

`number` = `100`

#### Returns

`Promise`\<readonly [`MembershipEventIntent`](/api/membership-core/src/type-aliases/membershipeventintent/)[]\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`listPendingEventIntents`](/api/membership-core/src/classes/membershipstore/#listpendingeventintents)

---

### markEventIntentPublished()

> **markEventIntentPublished**(`intentId`): `Promise`\<`void`\>

#### Parameters

##### intentId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`markEventIntentPublished`](/api/membership-core/src/classes/membershipstore/#markeventintentpublished)

---

### mutateOwner()

> **mutateOwner**(`input`): `Promise`\<[`MembershipOwnerMutationResult`](/api/membership-core/src/type-aliases/membershipownermutationresult/)\>

Applies an owner removal or demotion as one atomic transition.

Implementations must serialize competing mutations for the same tenant so the final owner
cannot be removed or demoted between validation and persistence. Serialization failures must
be returned as `conflict`.

#### Parameters

##### input

[`MembershipOwnerMutationInput`](/api/membership-core/src/type-aliases/membershipownermutationinput/)

#### Returns

`Promise`\<[`MembershipOwnerMutationResult`](/api/membership-core/src/type-aliases/membershipownermutationresult/)\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`mutateOwner`](/api/membership-core/src/classes/membershipstore/#mutateowner)

---

### save()

> **save**(`input`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Parameters

##### input

[`MembershipCreateInput`](/api/membership-core/src/type-aliases/membershipcreateinput/)

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`save`](/api/membership-core/src/classes/membershipstore/#save)

---

### transferOwnership()

> **transferOwnership**(`input`): `Promise`\<[`MembershipOwnershipTransferResult`](/api/membership-core/src/type-aliases/membershipownershiptransferresult/)\>

Transfers ownership as one atomic transition. Serialization failures must be returned as
`conflict`.

#### Parameters

##### input

[`MembershipOwnershipTransferInput`](/api/membership-core/src/type-aliases/membershipownershiptransferinput/)

#### Returns

`Promise`\<[`MembershipOwnershipTransferResult`](/api/membership-core/src/type-aliases/membershipownershiptransferresult/)\>

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`transferOwnership`](/api/membership-core/src/classes/membershipstore/#transferownership)
