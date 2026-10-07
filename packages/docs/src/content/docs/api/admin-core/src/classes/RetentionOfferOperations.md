---
editUrl: false
next: false
prev: false
title: "RetentionOfferOperations"
---

The actor is resolved from authenticated server context, never supplied in browser edits.

## Constructors

### Constructor

> **new RetentionOfferOperations**(`options`): `RetentionOfferOperations`

#### Parameters

##### options

`Readonly`\<\{ `registration`: readonly [`RegisteredCancellationChoice`](/api/billing-core/src/type-aliases/registeredcancellationchoice/)[]; `service`: `Pick`\<[`CancellationService`](/api/billing-core/src/classes/cancellationservice/), `"listSessions"` \| `"updatePolicy"`\>; `store`: `Pick`\<[`CancellationStore`](/api/billing-core/src/interfaces/cancellationstore/), `"getPolicy"`\>; `actor`: `Promise`\<`string`\>; `now`: `Date`; \}\>

#### Returns

`RetentionOfferOperations`

## Methods

### load()

> **load**(`scope`): `Promise`\<`Readonly`\<\{ `policy`: [`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/); `registration`: readonly [`RegisteredCancellationChoice`](/api/billing-core/src/type-aliases/registeredcancellationchoice/)[]; `reports`: readonly `Readonly`\<\{ `accepted`: `number`; `amount`: `string`; `billingPeriod`: `"initial"` \| `"renewal"`; `cancelled`: `number`; `currency`: `string`; `displayed`: `number`; `ended`: `number`; `indeterminate`: `number`; `kept`: `number`; `pending`: `number`; `policyVersion`: `number`; `refund`: `"partial"` \| `"none"` \| `"full"`; `refundsConfirmed`: `number`; `scheduled`: `number`; `sessions`: `number`; `subscriptionAgeDays`: `number`; \}\>[]; \}\>\>

#### Parameters

##### scope

[`CancellationScope`](/api/billing-core/src/type-aliases/cancellationscope/)

#### Returns

`Promise`\<`Readonly`\<\{ `policy`: [`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/); `registration`: readonly [`RegisteredCancellationChoice`](/api/billing-core/src/type-aliases/registeredcancellationchoice/)[]; `reports`: readonly `Readonly`\<\{ `accepted`: `number`; `amount`: `string`; `billingPeriod`: `"initial"` \| `"renewal"`; `cancelled`: `number`; `currency`: `string`; `displayed`: `number`; `ended`: `number`; `indeterminate`: `number`; `kept`: `number`; `pending`: `number`; `policyVersion`: `number`; `refund`: `"partial"` \| `"none"` \| `"full"`; `refundsConfirmed`: `number`; `scheduled`: `number`; `sessions`: `number`; `subscriptionAgeDays`: `number`; \}\>[]; \}\>\>

---

### save()

> **save**(`scope`, `edit`): `Promise`\<[`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/)\>

#### Parameters

##### scope

[`CancellationScope`](/api/billing-core/src/type-aliases/cancellationscope/)

##### edit

[`RetentionOfferEdit`](/api/admin-core/src/type-aliases/retentionofferedit/)

#### Returns

`Promise`\<[`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/)\>
