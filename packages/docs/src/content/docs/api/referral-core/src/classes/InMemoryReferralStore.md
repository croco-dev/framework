---
editUrl: false
next: false
prev: false
title: "InMemoryReferralStore"
---

Single-process referral store. The store itself serves as the transaction
handle, and `transact` serializes work through a mutex so concurrent
claims observe each other's first-valid insertions and budget
reservations, matching the atomicity contract PostgreSQL implementations
provide with unique constraints and row locks.

## Implements

- [`ReferralStore`](/api/referral-core/src/interfaces/referralstore/)
- [`ReferralTx`](/api/referral-core/src/interfaces/referraltx/)

## Constructors

### Constructor

> **new InMemoryReferralStore**(): `InMemoryReferralStore`

#### Returns

`InMemoryReferralStore`

## Methods

### addBudgetReservation()

> **addBudgetReservation**(`programId`, `version`, `amount`): `Promise`\<`void`\>

#### Parameters

##### programId

`string`

##### version

`number`

##### amount

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`addBudgetReservation`](/api/referral-core/src/interfaces/referraltx/#addbudgetreservation)

---

### compareAndSetAttribution()

> **compareAndSetAttribution**(`attributionId`, `expected`, `next`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

#### Parameters

##### attributionId

`string`

##### expected

readonly [`ReferralAttributionState`](/api/referral-core/src/type-aliases/referralattributionstate/)[]

##### next

[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`compareAndSetAttribution`](/api/referral-core/src/interfaces/referraltx/#compareandsetattribution)

---

### compareAndSetBenefitIntent()

> **compareAndSetBenefitIntent**(`intentId`, `expected`, `patch`, `now`): `Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)\>

#### Parameters

##### intentId

`string`

##### expected

readonly [`ReferralBenefitIntentStatus`](/api/referral-core/src/type-aliases/referralbenefitintentstatus/)[]

##### patch

###### accountRef?

`string`

###### reason?

`string`

###### receipt?

`string`

###### status

[`ReferralBenefitIntentStatus`](/api/referral-core/src/type-aliases/referralbenefitintentstatus/)

##### now

`Date`

#### Returns

`Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`compareAndSetBenefitIntent`](/api/referral-core/src/interfaces/referraltx/#compareandsetbenefitintent)

---

### countClicks()

> **countClicks**(`linkId`): `Promise`\<`number`\>

#### Parameters

##### linkId

`string`

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`countClicks`](/api/referral-core/src/interfaces/referraltx/#countclicks)

---

### countSubjectReceipts()

> **countSubjectReceipts**(`familyId`, `benefitCycleId`, `subject`, `states`): `Promise`\<`number`\>

#### Parameters

##### familyId

`string`

##### benefitCycleId

`string`

##### subject

[`ReferralSubject`](/api/referral-core/src/type-aliases/referralsubject/)

##### states

readonly [`ReferralAttributionState`](/api/referral-core/src/type-aliases/referralattributionstate/)[]

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`countSubjectReceipts`](/api/referral-core/src/interfaces/referraltx/#countsubjectreceipts)

---

### getAttribution()

> **getAttribution**(`attributionId`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/) \| `null`\>

#### Parameters

##### attributionId

`string`

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/) \| `null`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`getAttribution`](/api/referral-core/src/interfaces/referraltx/#getattribution)

---

### getBenefitIntent()

> **getBenefitIntent**(`intentId`): `Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/) \| `null`\>

#### Parameters

##### intentId

`string`

#### Returns

`Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/) \| `null`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`getBenefitIntent`](/api/referral-core/src/interfaces/referraltx/#getbenefitintent)

---

### getBenefitIntentByLogicalKey()

> **getBenefitIntentByLogicalKey**(`logicalKey`): `Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/) \| `null`\>

#### Parameters

##### logicalKey

`string`

#### Returns

`Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/) \| `null`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`getBenefitIntentByLogicalKey`](/api/referral-core/src/interfaces/referraltx/#getbenefitintentbylogicalkey)

---

### getFirstAttributionForRecipient()

> **getFirstAttributionForRecipient**(`familyId`, `recipient`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/) \| `null`\>

First-valid lookup: the earliest claimed attribution for a recipient in a family.

#### Parameters

##### familyId

`string`

##### recipient

[`ReferralSubject`](/api/referral-core/src/type-aliases/referralsubject/)

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/) \| `null`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`getFirstAttributionForRecipient`](/api/referral-core/src/interfaces/referraltx/#getfirstattributionforrecipient)

---

### getLink()

> **getLink**(`linkId`): `Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

#### Parameters

##### linkId

`string`

#### Returns

`Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`getLink`](/api/referral-core/src/interfaces/referraltx/#getlink)

---

### getLinkByTokenHash()

> **getLinkByTokenHash**(`tokenHash`): `Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

#### Parameters

##### tokenHash

`string`

#### Returns

`Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`getLinkByTokenHash`](/api/referral-core/src/interfaces/referraltx/#getlinkbytokenhash)

---

### getProgram()

> **getProgram**(`programId`, `version`): `Promise`\<[`ReferralProgramDefinition`](/api/referral-core/src/type-aliases/referralprogramdefinition/) \| `null`\>

#### Parameters

##### programId

`string`

##### version

`number`

#### Returns

`Promise`\<[`ReferralProgramDefinition`](/api/referral-core/src/type-aliases/referralprogramdefinition/) \| `null`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`getProgram`](/api/referral-core/src/interfaces/referraltx/#getprogram)

---

### latestProgramVersion()

> **latestProgramVersion**(`programId`): `Promise`\<`number` \| `null`\>

#### Parameters

##### programId

`string`

#### Returns

`Promise`\<`number` \| `null`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`latestProgramVersion`](/api/referral-core/src/interfaces/referraltx/#latestprogramversion)

---

### listAttributions()

> **listAttributions**(`filter`): `Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

#### Parameters

##### filter

[`ListAttributionsFilter`](/api/referral-core/src/type-aliases/listattributionsfilter/)

#### Returns

`Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`listAttributions`](/api/referral-core/src/interfaces/referraltx/#listattributions)

---

### listAttributionsForRecipient()

> **listAttributionsForRecipient**(`familyId`, `recipient`): `Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

#### Parameters

##### familyId

`string`

##### recipient

[`ReferralSubject`](/api/referral-core/src/type-aliases/referralsubject/)

#### Returns

`Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`listAttributionsForRecipient`](/api/referral-core/src/interfaces/referraltx/#listattributionsforrecipient)

---

### listAudits()

> **listAudits**(): `Promise`\<readonly [`ReferralAuditEntry`](/api/referral-core/src/type-aliases/referralauditentry/)[]\>

Test and console support: read-only audit trail in insertion order.

#### Returns

`Promise`\<readonly [`ReferralAuditEntry`](/api/referral-core/src/type-aliases/referralauditentry/)[]\>

---

### listBenefitIntents()

> **listBenefitIntents**(`filter`): `Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

#### Parameters

##### filter

[`ListBenefitIntentsFilter`](/api/referral-core/src/type-aliases/listbenefitintentsfilter/)

#### Returns

`Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`listBenefitIntents`](/api/referral-core/src/interfaces/referraltx/#listbenefitintents)

---

### listBenefitIntentsForAttribution()

> **listBenefitIntentsForAttribution**(`attributionId`): `Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

#### Parameters

##### attributionId

`string`

#### Returns

`Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`listBenefitIntentsForAttribution`](/api/referral-core/src/interfaces/referraltx/#listbenefitintentsforattribution)

---

### readBudgetReserved()

> **readBudgetReserved**(`programId`, `version`): `Promise`\<`string`\>

#### Parameters

##### programId

`string`

##### version

`number`

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`readBudgetReserved`](/api/referral-core/src/interfaces/referraltx/#readbudgetreserved)

---

### recordAudit()

> **recordAudit**(`entry`): `Promise`\<`void`\>

#### Parameters

##### entry

[`ReferralAuditEntry`](/api/referral-core/src/type-aliases/referralauditentry/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`recordAudit`](/api/referral-core/src/interfaces/referraltx/#recordaudit)

---

### recordClick()

> **recordClick**(`linkId`, `occurredAt`): `Promise`\<`void`\>

#### Parameters

##### linkId

`string`

##### occurredAt

`Date`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`recordClick`](/api/referral-core/src/interfaces/referraltx/#recordclick)

---

### releaseBudgetReservation()

> **releaseBudgetReservation**(`programId`, `version`, `amount`): `Promise`\<`void`\>

#### Parameters

##### programId

`string`

##### version

`number`

##### amount

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`releaseBudgetReservation`](/api/referral-core/src/interfaces/referraltx/#releasebudgetreservation)

---

### revokeLink()

> **revokeLink**(`linkId`, `revokedAt`): `Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/)\>

#### Parameters

##### linkId

`string`

##### revokedAt

`Date`

#### Returns

`Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/)\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`revokeLink`](/api/referral-core/src/interfaces/referraltx/#revokelink)

---

### saveAttribution()

> **saveAttribution**(`attribution`, `fingerprint`): `Promise`\<\{ `attribution`: [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/); `created`: `boolean`; \}\>

Persists an attribution. A known id with an identical fingerprint replays
as `{ created: false }`; a different payload under the same id is a
duplicate-claim conflict.

#### Parameters

##### attribution

[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)

##### fingerprint

`string`

#### Returns

`Promise`\<\{ `attribution`: [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/); `created`: `boolean`; \}\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`saveAttribution`](/api/referral-core/src/interfaces/referraltx/#saveattribution)

---

### saveBenefitIntent()

> **saveBenefitIntent**(`intent`): `Promise`\<\{ `created`: `boolean`; `intent`: [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/); \}\>

Persists a benefit intent; logical keys are unique per side.

#### Parameters

##### intent

[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)

#### Returns

`Promise`\<\{ `created`: `boolean`; `intent`: [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/); \}\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`saveBenefitIntent`](/api/referral-core/src/interfaces/referraltx/#savebenefitintent)

---

### saveLink()

> **saveLink**(`link`): `Promise`\<\{ `created`: `boolean`; `link`: [`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/); \}\>

Persists a link; token hashes are unique. Replays return `{ created: false }`.

#### Parameters

##### link

[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/)

#### Returns

`Promise`\<\{ `created`: `boolean`; `link`: [`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/); \}\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`saveLink`](/api/referral-core/src/interfaces/referraltx/#savelink)

---

### saveProgram()

> **saveProgram**(`program`): `Promise`\<\{ `created`: `boolean`; \}\>

Persists a registered program. The same `(id, version)` with an identical
document replays as `{ created: false }`; a different document under the
same `(id, version)` is a conflict.

#### Parameters

##### program

[`ReferralProgramDefinition`](/api/referral-core/src/type-aliases/referralprogramdefinition/)

#### Returns

`Promise`\<\{ `created`: `boolean`; \}\>

#### Implementation of

[`ReferralTx`](/api/referral-core/src/interfaces/referraltx/).[`saveProgram`](/api/referral-core/src/interfaces/referraltx/#saveprogram)

---

### transact()

> **transact**\<`T`\>(`work`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### work

(`tx`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

#### Implementation of

[`ReferralStore`](/api/referral-core/src/interfaces/referralstore/).[`transact`](/api/referral-core/src/interfaces/referralstore/#transact)
