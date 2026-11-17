---
editUrl: false
next: false
prev: false
title: "DrizzleInvitationStore"
---

초대 엔터티를 Drizzle로 저장하고 조회하는 구현체입니다.

## Extends

- [`InvitationStore`](/api/invitation-core/src/classes/invitationstore/)

## Constructors

### Constructor

> **new DrizzleInvitationStore**(`db`, `txManager`, `tokenCipher?`): `DrizzleInvitationStore`

Drizzle 클라이언트와 트랜잭션 매니저를 받아 저장소를 초기화합니다.

#### Parameters

##### db

[`DrizzleInvitationClient`](/api/invitation-drizzle/src/type-aliases/drizzleinvitationclient/)

##### txManager

[`TxManager`](/api/tx-core/src/classes/txmanager/)\<[`DrizzleInvitationClient`](/api/invitation-drizzle/src/type-aliases/drizzleinvitationclient/)\>

##### tokenCipher?

[`InvitationTokenCipher`](/api/invitation-drizzle/src/interfaces/invitationtokencipher/)

#### Returns

`DrizzleInvitationStore`

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`constructor`](/api/invitation-core/src/classes/invitationstore/#constructor)

## Methods

### activateEmailInvitation()

> **activateEmailInvitation**(`tenantId`, `idempotencyKey`, `expectedInvitationId?`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

Activate only a creating invitation whose ID matches the supplied expectation. Preserve other statuses.

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### expectedInvitationId?

`string`

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`activateEmailInvitation`](/api/invitation-core/src/classes/invitationstore/#activateemailinvitation)

---

### claimEmailInvitationEvent()

> **claimEmailInvitationEvent**(`tenantId`, `idempotencyKey`, `claimId`, `claimExpiresAt`, `expectedInvitationId?`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

When given an invitation ID, claim only that creation.

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

##### claimExpiresAt

`Date`

##### expectedInvitationId?

`string`

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`claimEmailInvitationEvent`](/api/invitation-core/src/classes/invitationstore/#claimemailinvitationevent)

---

### claimEmailInvitationNotification()

> **claimEmailInvitationNotification**(`tenantId`, `idempotencyKey`, `claimId`, `claimExpiresAt`, `expectedInvitationId?`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

When given an invitation ID, claim only that creation.

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

##### claimExpiresAt

`Date`

##### expectedInvitationId?

`string`

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`claimEmailInvitationNotification`](/api/invitation-core/src/classes/invitationstore/#claimemailinvitationnotification)

---

### compareAndSetStatus()

> **compareAndSetStatus**(`tenantId`, `id`, `expected`, `desired`, `meta?`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

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

[`InvitationStatusTransitionMeta`](/api/invitation-core/src/type-aliases/invitationstatustransitionmeta/) = `{}`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`compareAndSetStatus`](/api/invitation-core/src/classes/invitationstore/#compareandsetstatus)

---

### completeEmailInvitationEvent()

> **completeEmailInvitationEvent**(`tenantId`, `idempotencyKey`, `claimId`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`completeEmailInvitationEvent`](/api/invitation-core/src/classes/invitationstore/#completeemailinvitationevent)

---

### completeEmailInvitationNotification()

> **completeEmailInvitationNotification**(`tenantId`, `idempotencyKey`, `claimId`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`completeEmailInvitationNotification`](/api/invitation-core/src/classes/invitationstore/#completeemailinvitationnotification)

---

### countIssuedByTenant()

> **countIssuedByTenant**(`tenantId`, `since`): `Promise`\<`number`\>

일정 시점 이후 생성된 모든 상태의 초대 수를 반환합니다.

#### Parameters

##### tenantId

`string`

##### since

`Date`

#### Returns

`Promise`\<`number`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`countIssuedByTenant`](/api/invitation-core/src/classes/invitationstore/#countissuedbytenant)

---

### countPendingByTenant()

> **countPendingByTenant**(`tenantId`, `since`): `Promise`\<`number`\>

일정 시점 이후 생성된 대기 중 초대 수를 반환합니다.

#### Parameters

##### tenantId

`string`

##### since

`Date`

#### Returns

`Promise`\<`number`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`countPendingByTenant`](/api/invitation-core/src/classes/invitationstore/#countpendingbytenant)

---

### createEmailInvitation()

> **createEmailInvitation**(`input`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)\>

#### Parameters

##### input

[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`createEmailInvitation`](/api/invitation-core/src/classes/invitationstore/#createemailinvitation)

---

### createRateLimitedInvitation()

> **createRateLimitedInvitation**(`input`, `config`, `expiresInDays`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)\>

Validate the fingerprint and replay an unexpired creation for the same tenant and key first.
For a new creation, check both quota windows and reject any live pending invitation for the
same normalized email. Check and persist atomically using the store's admission time
for the quota cutoff, issuance timestamp and calendar-day lifetime.

#### Parameters

##### input

[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)

##### config

[`RateLimitConfig`](/api/invitation-core/src/type-aliases/ratelimitconfig/)

##### expiresInDays

`number`

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`createRateLimitedInvitation`](/api/invitation-core/src/classes/invitationstore/#createratelimitedinvitation)

---

### currentTime()

> **currentTime**(): `Promise`\<`Date`\>

Clock used to compare this store's persisted timestamps.

#### Returns

`Promise`\<`Date`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`currentTime`](/api/invitation-core/src/classes/invitationstore/#currenttime)

---

### deleteExpiredEmailInvitationCreations()

> **deleteExpiredEmailInvitationCreations**(`now`): `Promise`\<`number`\>

#### Parameters

##### now

`Date`

#### Returns

`Promise`\<`number`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`deleteExpiredEmailInvitationCreations`](/api/invitation-core/src/classes/invitationstore/#deleteexpiredemailinvitationcreations)

---

### findAllByTenant()

> **findAllByTenant**(`tenantId`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)[]\>

테넌트의 모든 초대를 조회합니다.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)[]\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`findAllByTenant`](/api/invitation-core/src/classes/invitationstore/#findallbytenant)

---

### findById()

> **findById**(`id`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

초대 ID로 초대를 조회합니다.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`findById`](/api/invitation-core/src/classes/invitationstore/#findbyid)

---

### findByTenantAndEmail()

> **findByTenantAndEmail**(`tenantId`, `email`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

테넌트와 이메일 조합으로 초대를 조회합니다.

#### Parameters

##### tenantId

`string`

##### email

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`findByTenantAndEmail`](/api/invitation-core/src/classes/invitationstore/#findbytenantandemail)

---

### findByTokenHash()

> **findByTokenHash**(`tokenHash`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

토큰 해시로 초대를 조회합니다.

#### Parameters

##### tokenHash

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`findByTokenHash`](/api/invitation-core/src/classes/invitationstore/#findbytokenhash)

---

### findEmailInvitationCreation()

> **findEmailInvitationCreation**(`tenantId`, `idempotencyKey`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`findEmailInvitationCreation`](/api/invitation-core/src/classes/invitationstore/#findemailinvitationcreation)

---

### releaseEmailInvitationEvent()

> **releaseEmailInvitationEvent**(`tenantId`, `idempotencyKey`, `claimId`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`releaseEmailInvitationEvent`](/api/invitation-core/src/classes/invitationstore/#releaseemailinvitationevent)

---

### releaseEmailInvitationNotification()

> **releaseEmailInvitationNotification**(`tenantId`, `idempotencyKey`, `claimId`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`releaseEmailInvitationNotification`](/api/invitation-core/src/classes/invitationstore/#releaseemailinvitationnotification)

---

### save()

> **save**(`invitation`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

초대를 upsert 방식으로 저장합니다.

#### Parameters

##### invitation

[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`save`](/api/invitation-core/src/classes/invitationstore/#save)

---

### updateStatus()

> **updateStatus**(`tenantId`, `id`, `status`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

초대 상태를 변경하고 변경된 초대를 반환합니다.

#### Parameters

##### tenantId

`string`

##### id

`string`

##### status

[`InvitationStatus`](/api/invitation-core/src/type-aliases/invitationstatus/)

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

#### Overrides

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`updateStatus`](/api/invitation-core/src/classes/invitationstore/#updatestatus)

---

### assertNoPendingInvitation()

> `static` **assertNoPendingInvitation**(`invitation`, `now`): `void`

#### Parameters

##### invitation

[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`

##### now

`number`

#### Returns

`void`

#### Inherited from

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`assertNoPendingInvitation`](/api/invitation-core/src/classes/invitationstore/#assertnopendinginvitation)

---

### assertRateLimitConfig()

> `static` **assertRateLimitConfig**(`config`): `void`

#### Parameters

##### config

[`RateLimitConfig`](/api/invitation-core/src/type-aliases/ratelimitconfig/)

#### Returns

`void`

#### Inherited from

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`assertRateLimitConfig`](/api/invitation-core/src/classes/invitationstore/#assertratelimitconfig)

---

### checkIssuanceRateLimit()

> `static` **checkIssuanceRateLimit**(`store`, `tenantId`, `config`, `now?`): `Promise`\<`void`\>

Inspect current usage without reserving capacity.

#### Parameters

##### store

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/)

##### tenantId

`string`

##### config

[`RateLimitConfig`](/api/invitation-core/src/type-aliases/ratelimitconfig/)

##### now?

`number`

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`checkIssuanceRateLimit`](/api/invitation-core/src/classes/invitationstore/#checkissuanceratelimit)

---

### currentTimeMillis()

> `static` **currentTimeMillis**(`store`): `Promise`\<`number`\>

#### Parameters

##### store

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/)

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`currentTimeMillis`](/api/invitation-core/src/classes/invitationstore/#currenttimemillis)

---

### dateCreation()

> `static` **dateCreation**(`input`, `issuedAt`, `expiresInDays`): [`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)

#### Parameters

##### input

[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)

##### issuedAt

`Date`

##### expiresInDays

`number`

#### Returns

[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)

#### Inherited from

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`dateCreation`](/api/invitation-core/src/classes/invitationstore/#datecreation)

---

### expiryDate()

> `static` **expiryDate**(`issuedAt`, `expiresInDays`): `Date`

#### Parameters

##### issuedAt

`Date`

##### expiresInDays

`number`

#### Returns

`Date`

#### Inherited from

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`expiryDate`](/api/invitation-core/src/classes/invitationstore/#expirydate)

---

### issuanceWindows()

> `static` **issuanceWindows**(`config`, `now`): `object`[]

#### Parameters

##### config

[`RateLimitConfig`](/api/invitation-core/src/type-aliases/ratelimitconfig/)

##### now

`number`

#### Returns

`object`[]

#### Inherited from

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/).[`issuanceWindows`](/api/invitation-core/src/classes/invitationstore/#issuancewindows)
