---
editUrl: false
next: false
prev: false
title: "ReferralFulfillmentPort"
---

External benefit boundary. `fulfill` must be idempotent on
`idempotencyKey`: a retry after response loss returns the original grant
instead of paying twice. `check` reports a previously completed grant or
null when nothing durable is visible; it never pays. `reverse` posts a
compensating return for an already granted side; it never deletes history.

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

---

### reverse()?

> `optional` **reverse**(`input`): `Promise`\<\{ `returnRef`: `string`; \} \| \{ `error`: `string`; \}\>

#### Parameters

##### input

###### attributionId

`string`

###### intent

[`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)

###### policy

`string`

###### reason

`string`

###### returnIdempotencyKey

`string`

###### subject

[`ReferralSubject`](/api/referral-core/src/type-aliases/referralsubject/)

#### Returns

`Promise`\<\{ `returnRef`: `string`; \} \| \{ `error`: `string`; \}\>
