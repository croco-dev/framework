---
editUrl: false
next: false
prev: false
title: "ReferralProgressState"
---

> **ReferralProgressState** = `Readonly`\<\{ `kind`: `"loading"`; \}\> \| `Readonly`\<\{ `kind`: `"denied"`; `message`: `string`; `retry?`: () => `void`; \}\> \| `Readonly`\<\{ `kind`: `"error"`; `message`: `string`; `retry?`: () => `void`; \}\> \| `Readonly`\<\{ `attribution`: [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/); `funnel`: [`ReferralFunnelCounts`](/api/referral-core/src/type-aliases/referralfunnelcounts/); `kind`: `"ready"`; `recipientBenefit`: [`ReferralBenefit`](/api/referral-core/src/type-aliases/referralbenefit/); `referrerBenefit`: [`ReferralBenefit`](/api/referral-core/src/type-aliases/referralbenefit/); \}\>
