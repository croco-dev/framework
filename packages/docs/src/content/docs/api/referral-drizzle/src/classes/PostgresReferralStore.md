---
editUrl: false
next: false
prev: false
title: "PostgresReferralStore"
---

PostgreSQL adapter for a Drizzle node-postgres execute/transaction boundary.

## Implements

- [`ReferralStore`](/api/referral-core/src/interfaces/referralstore/)

## Constructors

### Constructor

> **new PostgresReferralStore**(`database`): `PostgresReferralStore`

#### Parameters

##### database

[`ReferralPgDatabase`](/api/referral-drizzle/src/interfaces/referralpgdatabase/)

#### Returns

`PostgresReferralStore`

## Methods

### getAttribution()

> **getAttribution**(`attributionId`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/) \| `null`\>

#### Parameters

##### attributionId

`string`

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/) \| `null`\>

#### Implementation of

[`ReferralStore`](/api/referral-core/src/interfaces/referralstore/).[`getAttribution`](/api/referral-core/src/interfaces/referralstore/#getattribution)

---

### getBenefitIntent()

> **getBenefitIntent**(`intentId`): `Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/) \| `null`\>

#### Parameters

##### intentId

`string`

#### Returns

`Promise`\<[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/) \| `null`\>

#### Implementation of

[`ReferralStore`](/api/referral-core/src/interfaces/referralstore/).[`getBenefitIntent`](/api/referral-core/src/interfaces/referralstore/#getbenefitintent)

---

### getLink()

> **getLink**(`linkId`): `Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

#### Parameters

##### linkId

`string`

#### Returns

`Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

#### Implementation of

[`ReferralStore`](/api/referral-core/src/interfaces/referralstore/).[`getLink`](/api/referral-core/src/interfaces/referralstore/#getlink)

---

### getLinkByTokenHash()

> **getLinkByTokenHash**(`tokenHash`): `Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

#### Parameters

##### tokenHash

`string`

#### Returns

`Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/) \| `null`\>

#### Implementation of

[`ReferralStore`](/api/referral-core/src/interfaces/referralstore/).[`getLinkByTokenHash`](/api/referral-core/src/interfaces/referralstore/#getlinkbytokenhash)

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

[`ReferralStore`](/api/referral-core/src/interfaces/referralstore/).[`getProgram`](/api/referral-core/src/interfaces/referralstore/#getprogram)

---

### latestProgramVersion()

> **latestProgramVersion**(`programId`): `Promise`\<`number` \| `null`\>

#### Parameters

##### programId

`string`

#### Returns

`Promise`\<`number` \| `null`\>

#### Implementation of

[`ReferralStore`](/api/referral-core/src/interfaces/referralstore/).[`latestProgramVersion`](/api/referral-core/src/interfaces/referralstore/#latestprogramversion)

---

### listAttributions()

> **listAttributions**(`filter`): `Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

#### Parameters

##### filter

[`ListAttributionsFilter`](/api/referral-core/src/type-aliases/listattributionsfilter/)

#### Returns

`Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

#### Implementation of

[`ReferralStore`](/api/referral-core/src/interfaces/referralstore/).[`listAttributions`](/api/referral-core/src/interfaces/referralstore/#listattributions)

---

### listBenefitIntents()

> **listBenefitIntents**(`filter`): `Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

#### Parameters

##### filter

[`ListBenefitIntentsFilter`](/api/referral-core/src/type-aliases/listbenefitintentsfilter/)

#### Returns

`Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

#### Implementation of

[`ReferralStore`](/api/referral-core/src/interfaces/referralstore/).[`listBenefitIntents`](/api/referral-core/src/interfaces/referralstore/#listbenefitintents)

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
