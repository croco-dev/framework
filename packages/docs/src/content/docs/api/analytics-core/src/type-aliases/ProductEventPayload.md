---
editUrl: false
next: false
prev: false
title: "ProductEventPayload"
---

> **ProductEventPayload**\<`S`\> = `{ [K in keyof S["properties"] as S["properties"][K] extends { optional: true } ? never : K]: PropertyValue<S["properties"][K]> }` & `{ [K in keyof S["properties"] as S["properties"][K] extends { optional: true } ? K : never]?: PropertyValue<S["properties"][K]> }`

## Type Parameters

### S

`S` _extends_ [`ProductEventObjectSchema`](/api/analytics-core/src/type-aliases/producteventobjectschema/)
