---
editUrl: false
next: false
prev: false
title: "InvitationStore"
---

초대 저장소 추상 계약과 상태 전이 메타 타입입니다.

## Extended by

- [`InMemoryInvitationStore`](/api/invitation-core/src/classes/inmemoryinvitationstore/)
- [`DrizzleInvitationStore`](/api/invitation-drizzle/src/classes/drizzleinvitationstore/)

## Constructors

### Constructor

> **new InvitationStore**(): `InvitationStore`

#### Returns

`InvitationStore`

## Methods

### activateEmailInvitation()

> `abstract` **activateEmailInvitation**(`tenantId`, `idempotencyKey`, `expectedInvitationId?`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

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

---

### claimEmailInvitationEvent()

> `abstract` **claimEmailInvitationEvent**(`tenantId`, `idempotencyKey`, `claimId`, `claimExpiresAt`, `expectedInvitationId?`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

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

---

### claimEmailInvitationNotification()

> `abstract` **claimEmailInvitationNotification**(`tenantId`, `idempotencyKey`, `claimId`, `claimExpiresAt`, `expectedInvitationId?`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

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

---

### compareAndSetStatus()

> `abstract` **compareAndSetStatus**(`tenantId`, `id`, `expected`, `desired`, `meta?`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

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

[`InvitationStatusTransitionMeta`](/api/invitation-core/src/type-aliases/invitationstatustransitionmeta/)

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

---

### completeEmailInvitationEvent()

> `abstract` **completeEmailInvitationEvent**(`tenantId`, `idempotencyKey`, `claimId`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

---

### completeEmailInvitationNotification()

> `abstract` **completeEmailInvitationNotification**(`tenantId`, `idempotencyKey`, `claimId`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

---

### countIssuedByTenant()

> `abstract` **countIssuedByTenant**(`tenantId`, `since`): `Promise`\<`number`\>

Count all invitations created at or after since for this tenant, regardless of status.

#### Parameters

##### tenantId

`string`

##### since

`Date`

#### Returns

`Promise`\<`number`\>

---

### countPendingByTenant()

> `abstract` **countPendingByTenant**(`tenantId`, `since`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

##### since

`Date`

#### Returns

`Promise`\<`number`\>

---

### createEmailInvitation()

> `abstract` **createEmailInvitation**(`input`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)\>

#### Parameters

##### input

[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)\>

---

### createRateLimitedInvitation()?

> `optional` **createRateLimitedInvitation**(`input`, `config`, `expiresInDays`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/)\>

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

---

### currentTime()?

> `optional` **currentTime**(): `Promise`\<`Date`\>

Clock used to compare this store's persisted timestamps.

#### Returns

`Promise`\<`Date`\>

---

### deleteExpiredEmailInvitationCreations()

> `abstract` **deleteExpiredEmailInvitationCreations**(`now`): `Promise`\<`number`\>

#### Parameters

##### now

`Date`

#### Returns

`Promise`\<`number`\>

---

### findAllByTenant()

> `abstract` **findAllByTenant**(`tenantId`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)[]\>

---

### findById()

> `abstract` **findById**(`id`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

---

### findByTenantAndEmail()

> `abstract` **findByTenantAndEmail**(`tenantId`, `email`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### email

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

---

### findByTokenHash()

> `abstract` **findByTokenHash**(`tokenHash`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

#### Parameters

##### tokenHash

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

---

### findEmailInvitationCreation()

> `abstract` **findEmailInvitationCreation**(`tenantId`, `idempotencyKey`): `Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`EmailInvitationCreation`](/api/invitation-core/src/type-aliases/emailinvitationcreation/) \| `null`\>

---

### releaseEmailInvitationEvent()

> `abstract` **releaseEmailInvitationEvent**(`tenantId`, `idempotencyKey`, `claimId`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<`void`\>

---

### releaseEmailInvitationNotification()

> `abstract` **releaseEmailInvitationNotification**(`tenantId`, `idempotencyKey`, `claimId`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<`void`\>

---

### save()

> `abstract` **save**(`invitation`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### invitation

[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

---

### updateStatus()

> `abstract` **updateStatus**(`tenantId`, `id`, `status`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### id

`string`

##### status

[`InvitationStatus`](/api/invitation-core/src/type-aliases/invitationstatus/)

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/) \| `null`\>

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

---

### assertRateLimitConfig()

> `static` **assertRateLimitConfig**(`config`): `void`

#### Parameters

##### config

[`RateLimitConfig`](/api/invitation-core/src/type-aliases/ratelimitconfig/)

#### Returns

`void`

---

### checkIssuanceRateLimit()

> `static` **checkIssuanceRateLimit**(`store`, `tenantId`, `config`, `now?`): `Promise`\<`void`\>

Inspect current usage without reserving capacity.

#### Parameters

##### store

`InvitationStore`

##### tenantId

`string`

##### config

[`RateLimitConfig`](/api/invitation-core/src/type-aliases/ratelimitconfig/)

##### now?

`number`

#### Returns

`Promise`\<`void`\>

---

### currentTimeMillis()

> `static` **currentTimeMillis**(`store`): `Promise`\<`number`\>

#### Parameters

##### store

`InvitationStore`

#### Returns

`Promise`\<`number`\>

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
