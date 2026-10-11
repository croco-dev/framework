---
editUrl: false
next: false
prev: false
title: "ReferralConsoleState"
---

> **ReferralConsoleState** = \{ `appId`: `string`; `environment`: `string`; `kind`: `"loading"`; \} \| \{ `appId`: `string`; `environment`: `string`; `kind`: `"empty"`; `message?`: `string`; \} \| \{ `appId`: `string`; `environment`: `string`; `grantedPermissions`: readonly `string`[]; `kind`: `"permission-denied"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `requiredPermissions`: readonly `string`[]; \} \| \{ `appId`: `string`; `environment`: `string`; `kind`: `"problem"`; `partial?`: [`ReferralConsoleReadyState`](/api/admin-core/src/type-aliases/referralconsolereadystate/); `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); \} \| [`ReferralConsoleReadyState`](/api/admin-core/src/type-aliases/referralconsolereadystate/)
