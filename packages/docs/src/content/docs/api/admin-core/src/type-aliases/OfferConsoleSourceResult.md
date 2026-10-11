---
editUrl: false
next: false
prev: false
title: "OfferConsoleSourceResult"
---

> **OfferConsoleSourceResult** = \{ `kind`: `"empty"`; `message?`: `string`; \} \| \{ `kind`: `"ready"`; `snapshot`: [`OfferConsoleSnapshot`](/api/admin-core/src/type-aliases/offerconsolesnapshot/); \} \| \{ `kind`: `"problem"`; `partial?`: [`OfferConsoleSnapshot`](/api/admin-core/src/type-aliases/offerconsolesnapshot/); `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); \}
