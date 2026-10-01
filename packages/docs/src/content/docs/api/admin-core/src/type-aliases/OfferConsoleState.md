---
editUrl: false
next: false
prev: false
title: "OfferConsoleState"
---

> **OfferConsoleState** = \{ `appId`: `string`; `environment`: `string`; `kind`: `"loading"`; \} \| \{ `appId`: `string`; `environment`: `string`; `kind`: `"empty"`; `message?`: `string`; \} \| \{ `appId`: `string`; `environment`: `string`; `grantedPermissions`: readonly `string`[]; `kind`: `"permission-denied"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `requiredPermissions`: readonly `string`[]; \} \| \{ `appId`: `string`; `environment`: `string`; `kind`: `"problem"`; `partial?`: [`OfferConsoleReadyState`](/api/admin-core/src/type-aliases/offerconsolereadystate/); `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); \} \| [`OfferConsoleReadyState`](/api/admin-core/src/type-aliases/offerconsolereadystate/)
