---
editUrl: false
next: false
prev: false
title: "EventCatalogPayloadValidationState"
---

> **EventCatalogPayloadValidationState** = \{ `delivery`: `"not-sent"`; `kind`: `"valid"`; `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `delivery`: `"not-sent"`; `kind`: `"invalid"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `delivery`: `"not-sent"`; `kind`: `"not-found"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `kind`: `"permission-denied"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `requiredPermissions`: readonly `string`[]; `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `kind`: `"unsupported"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `kind`: `"problem"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \}
