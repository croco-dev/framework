---
editUrl: false
next: false
prev: false
title: "CreditOperationsSourceResult"
---

> **CreditOperationsSourceResult** = \{ `kind`: `"empty"`; `message?`: `string`; \} \| \{ `kind`: `"ready"`; `snapshot`: [`CreditOperationsSnapshot`](/api/admin-core/src/type-aliases/creditoperationssnapshot/); \} \| \{ `actualPosition`: `number`; `expectedPosition`: `number`; `kind`: `"stale"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `snapshot`: [`CreditOperationsSnapshot`](/api/admin-core/src/type-aliases/creditoperationssnapshot/); \} \| \{ `kind`: `"problem"`; `partial?`: [`CreditOperationsSnapshot`](/api/admin-core/src/type-aliases/creditoperationssnapshot/); `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); \}
