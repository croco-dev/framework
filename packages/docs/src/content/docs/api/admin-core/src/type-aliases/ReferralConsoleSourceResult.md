---
editUrl: false
next: false
prev: false
title: "ReferralConsoleSourceResult"
---

> **ReferralConsoleSourceResult** = \{ `kind`: `"empty"`; `message?`: `string`; \} \| \{ `kind`: `"ready"`; `snapshot`: [`ReferralConsoleSnapshot`](/api/admin-core/src/type-aliases/referralconsolesnapshot/); \} \| \{ `kind`: `"problem"`; `partial?`: [`ReferralConsoleSnapshot`](/api/admin-core/src/type-aliases/referralconsolesnapshot/); `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); \}
