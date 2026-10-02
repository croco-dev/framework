---
editUrl: false
next: false
prev: false
title: "ExperimentReviewConsoleState"
---

> **ExperimentReviewConsoleState** = \{ `appId`: `string`; `environment`: `string`; `kind`: `"loading"`; \} \| \{ `appId`: `string`; `environment`: `string`; `kind`: `"empty"`; `message?`: `string`; \} \| \{ `appId`: `string`; `environment`: `string`; `kind`: `"tenant-required"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); \} \| \{ `appId`: `string`; `environment`: `string`; `grantedPermissions`: readonly `string`[]; `kind`: `"permission-denied"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `requiredPermissions`: readonly `string`[]; \} \| \{ `appId`: `string`; `environment`: `string`; `kind`: `"problem"`; `partial?`: [`ExperimentReviewReadyState`](/api/admin-core/src/type-aliases/experimentreviewreadystate/); `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); \} \| [`ExperimentReviewReadyState`](/api/admin-core/src/type-aliases/experimentreviewreadystate/)
