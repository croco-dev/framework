---
editUrl: false
next: false
prev: false
title: "OfferEligibilityHook"
---

> **OfferEligibilityHook** = (`input`) => `Promise`\<[`EligibilityVerdict`](/api/promotions-core/src/type-aliases/eligibilityverdict/)\> \| [`EligibilityVerdict`](/api/promotions-core/src/type-aliases/eligibilityverdict/)

Live eligibility hook; re-evaluated server-side at accept time, not just exposure.

## Parameters

### input

#### now

`Date`

#### policy

[`RegisteredOfferPolicy`](/api/promotions-core/src/type-aliases/registeredofferpolicy/)

#### subject

[`OfferSubject`](/api/promotions-core/src/type-aliases/offersubject/)

## Returns

`Promise`\<[`EligibilityVerdict`](/api/promotions-core/src/type-aliases/eligibilityverdict/)\> \| [`EligibilityVerdict`](/api/promotions-core/src/type-aliases/eligibilityverdict/)
