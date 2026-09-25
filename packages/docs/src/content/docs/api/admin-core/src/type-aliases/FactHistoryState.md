---
editUrl: false
next: false
prev: false
title: "FactHistoryState"
---

> **FactHistoryState** = \{ `kind`: `"loading"`; \} \| \{ `code`: `string`; `kind`: `"denied"`; \} \| \{ `code`: `string`; `kind`: `"error"`; \} \| \{ `kind`: `"empty"`; `snapshot`: [`FactHistorySnapshot`](/api/admin-core/src/type-aliases/facthistorysnapshot/); \} \| \{ `kind`: `"ready"`; `snapshot`: [`FactHistorySnapshot`](/api/admin-core/src/type-aliases/facthistorysnapshot/); \} \| \{ `kind`: `"partial"`; `snapshot`: [`FactHistorySnapshot`](/api/admin-core/src/type-aliases/facthistorysnapshot/); \}
