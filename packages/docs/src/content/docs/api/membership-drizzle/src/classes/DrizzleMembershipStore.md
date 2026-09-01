---
editUrl: false
next: false
prev: false
title: "DrizzleMembershipStore"
---

멤버십 엔터티를 Drizzle로 저장하고 조회하는 구현체입니다.

## Extends

- [`MembershipStore`](/api/membership-core/src/classes/membershipstore/)

## Constructors

### Constructor

> **new DrizzleMembershipStore**(`db`, `txManager`): `DrizzleMembershipStore`

Drizzle 클라이언트와 트랜잭션 매니저를 받아 저장소를 초기화합니다.

#### Parameters

##### db

[`DrizzleMembershipClient`](/api/membership-drizzle/src/type-aliases/drizzlemembershipclient/)

##### txManager

[`TxManager`](/api/tx-core/src/classes/txmanager/)\<[`DrizzleMembershipClient`](/api/membership-drizzle/src/type-aliases/drizzlemembershipclient/)\>

#### Returns

`DrizzleMembershipStore`

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`constructor`](/api/membership-core/src/classes/membershipstore/#constructor)

## Properties

### eventIntentDurability

> `readonly` **eventIntentDurability**: `"persistent"`

#### Overrides

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/).[`eventIntentDurability`](/api/membership-core/src/classes/membershipstore/#eventintentdurability)

## Methods

### countAll()

> **countAll**(`tenantId`): `Promise`\<`number`\>

테넌트의 전체 멤버 수를 반환합니다.

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

특정 역할의 멤버 수를 반환합니다.

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

테넌트의 모든 멤버십을 조회합니다.

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

사용자의 모든 멤버십을 조회합니다.

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

테넌트와 사용자 조합으로 멤버십을 조회합니다.

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
