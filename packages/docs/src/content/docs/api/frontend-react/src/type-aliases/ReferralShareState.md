---
editUrl: false
next: false
prev: false
title: "ReferralShareState"
---

> **ReferralShareState** = `Readonly`\<\{ `kind`: `"loading"`; \}\> \| `Readonly`\<\{ `kind`: `"denied"`; `message`: `string`; `retry?`: () => `void`; \}\> \| `Readonly`\<\{ `kind`: `"error"`; `message`: `string`; `retry?`: () => `void`; \}\> \| `Readonly`\<\{ `expiresAt`: `Date`; `kind`: `"ready"`; `link`: [`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/); `shareHref`: `string`; \}\>
