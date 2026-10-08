---
editUrl: false
next: false
prev: false
title: "ReferralTx"
---

Transactional referral storage boundary.

Implementations must make `transact` atomic: first-valid insertion,
subject counting, budget reservation, and benefit intent creation inside
one `transact` call observe each other, so concurrent claims serialize
instead of crediting two referrers or overspending the budget. Benefit
intent status changes are compare-and-set guarded by the expected states.

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

---

### countClicks()

> **countClicks**(`linkId`): `Promise`\<`number`\>

#### Parameters

##### linkId

`string`

#### Returns

`Promise`\<`number`\>

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

---

### getAttribution()

> **getAttribution**(`attributionId`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/) \| `null`\>

#### Parameters

##### attributionId

`string`

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/) \| `null`\>

---

### getBenefitIntent()

> **getBenefitIntent**(`intentId`): `Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/) \| `null`\>

#### Parameters

##### intentId

`string`

#### Returns

`Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/) \| `null`\>

---

### getBenefitIntentByLogicalKey()

> **getBenefitIntentByLogicalKey**(`logicalKey`): `Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/) \| `null`\>

#### Parameters

##### logicalKey

`string`

#### Returns

`Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/) \| `null`\>

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

---

### getLink()

> **getLink**(`linkId`): `Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

#### Parameters

##### linkId

`string`

#### Returns

`Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

---

### getLinkByTokenHash()

> **getLinkByTokenHash**(`tokenHash`): `Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

#### Parameters

##### tokenHash

`string`

#### Returns

`Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

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

---

### latestProgramVersion()

> **latestProgramVersion**(`programId`): `Promise`\<`number` \| `null`\>

#### Parameters

##### programId

`string`

#### Returns

`Promise`\<`number` \| `null`\>

---

### listAttributions()

> **listAttributions**(`filter`): `Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

#### Parameters

##### filter

[`ListAttributionsFilter`](/api/referral-core/src/type-aliases/listattributionsfilter/)

#### Returns

`Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

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

---

### listBenefitIntents()

> **listBenefitIntents**(`filter`): `Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

#### Parameters

##### filter

[`ListBenefitIntentsFilter`](/api/referral-core/src/type-aliases/listbenefitintentsfilter/)

#### Returns

`Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

---

### listBenefitIntentsForAttribution()

> **listBenefitIntentsForAttribution**(`attributionId`): `Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

#### Parameters

##### attributionId

`string`

#### Returns

`Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

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

---

### recordAudit()

> **recordAudit**(`entry`): `Promise`\<`void`\>

#### Parameters

##### entry

[`ReferralAuditEntry`](/api/referral-core/src/type-aliases/referralauditentry/)

#### Returns

`Promise`\<`void`\>

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

---

### saveBenefitIntent()

> **saveBenefitIntent**(`intent`): `Promise`\<\{ `created`: `boolean`; `intent`: [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/); \}\>

Persists a benefit intent; logical keys are unique per side.

#### Parameters

##### intent

[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)

#### Returns

`Promise`\<\{ `created`: `boolean`; `intent`: [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/); \}\>

---

### saveLink()

> **saveLink**(`link`): `Promise`\<\{ `created`: `boolean`; `link`: [`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/); \}\>

Persists a link; token hashes are unique. Replays return `{ created: false }`.

#### Parameters

##### link

[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/)

#### Returns

`Promise`\<\{ `created`: `boolean`; `link`: [`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/); \}\>

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
