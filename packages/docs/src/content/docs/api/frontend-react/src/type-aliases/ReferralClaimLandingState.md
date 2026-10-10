---
editUrl: false
next: false
prev: false
title: "ReferralClaimLandingState"
---

> **ReferralClaimLandingState** = `Readonly`\<\{ `kind`: `"loading"`; \}\> \| `Readonly`\<\{ `kind`: `"denied"`; `message`: `string`; `retry?`: () => `void`; \}\> \| `Readonly`\<\{ `kind`: `"error"`; `message`: `string`; `retry?`: () => `void`; \}\> \| `Readonly`\<\{ `conversionDeadline`: `Date`; `inviterLabel`: `string`; `kind`: `"ready"`; `programEnded`: `boolean`; `qualifyingAction`: `string`; `recipientBenefit`: [`ReferralBenefit`](/api/referral-core/src/type-aliases/referralbenefit/); \}\>
