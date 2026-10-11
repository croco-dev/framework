---
editUrl: false
next: false
prev: false
title: "Column"
---

> **Column** = [`ColumnMetadata`](/api/warehouse-core/src/type-aliases/columnmetadata/) & \{ `type`: `"id"` \| `"string"` \| `"boolean"` \| `"currency"`; \} \| \{ `subject`: `string`; `type`: `"subject"`; \} \| \{ `max?`: `string`; `min?`: `string`; `type`: `"int64"`; \} \| \{ `currency`: `string`; `max?`: `string`; `min?`: `string`; `type`: `"money"`; \} \| \{ `precision`: `number`; `scale`: `number`; `type`: `"decimal"`; \} \| \{ `precision`: `"second"` \| `"millisecond"` \| `"microsecond"`; `type`: `"instant"`; \} \| \{ `type`: `"date"`; `zone`: `string`; \}
