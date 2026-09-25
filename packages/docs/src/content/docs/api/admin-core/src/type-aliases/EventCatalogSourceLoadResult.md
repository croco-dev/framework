---
editUrl: false
next: false
prev: false
title: "EventCatalogSourceLoadResult"
---

> **EventCatalogSourceLoadResult** = \{ `entries`: readonly [`EventCatalogEntry`](/api/admin-core/src/type-aliases/eventcatalogentry/)[]; `kind`: `"ready"`; `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `entries`: readonly [`EventCatalogEntry`](/api/admin-core/src/type-aliases/eventcatalogentry/)[]; `kind`: `"partial"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `kind`: `"unsupported"`; `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \} \| \{ `kind`: `"problem"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `scope`: [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/); \}
