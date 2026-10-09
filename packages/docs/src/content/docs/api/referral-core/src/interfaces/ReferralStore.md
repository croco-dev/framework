---
editUrl: false
next: false
prev: false
title: "ReferralStore"
---

## Methods

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

### listBenefitIntents()

> **listBenefitIntents**(`filter`): `Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

#### Parameters

##### filter

[`ListBenefitIntentsFilter`](/api/referral-core/src/type-aliases/listbenefitintentsfilter/)

#### Returns

`Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

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
