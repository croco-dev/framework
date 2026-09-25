---
editUrl: false
next: false
prev: false
title: "EventCatalogSourceValidationResult"
---

> **EventCatalogSourceValidationResult** = \{ `kind`: `"valid"`; `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `code`: `string`; `kind`: `"invalid"`; `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `kind`: `"not-found"`; `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `kind`: `"unsupported"`; `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `kind`: `"problem"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \}
