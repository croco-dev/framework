---
editUrl: false
next: false
prev: false
title: "ReferralFulfillmentPort"
---

External benefit boundary. `fulfill` must be idempotent on
`idempotencyKey`: a retry after response loss returns the original grant
instead of paying twice. `check` reports a previously completed grant or
null when nothing durable is visible; it never pays.

## Methods

### check()

> **check**(`input`): `Promise`\<\{ `grantRef`: `string`; \} \| `null`\>

#### Parameters

##### input

###### idempotencyKey

`string`

###### intent

[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)

###### subject

[`ReferralSubject`](/api/referral-core/src/type-aliases/referralsubject/)

#### Returns

`Promise`\<\{ `grantRef`: `string`; \} \| `null`\>

---

### fulfill()

> **fulfill**(`input`): `Promise`\<[`ReferralFulfillmentResult`](/api/referral-core/src/type-aliases/referralfulfillmentresult/)\>

#### Parameters

##### input

###### attribution

[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)

###### idempotencyKey

`string`

###### intent

[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)

###### program

[`ReferralProgramDefinition`](/api/referral-core/src/type-aliases/referralprogramdefinition/)

###### subject

[`ReferralSubject`](/api/referral-core/src/type-aliases/referralsubject/)

#### Returns

`Promise`\<[`ReferralFulfillmentResult`](/api/referral-core/src/type-aliases/referralfulfillmentresult/)\>
