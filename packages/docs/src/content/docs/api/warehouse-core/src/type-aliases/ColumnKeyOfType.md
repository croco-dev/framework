---
editUrl: false
next: false
prev: false
title: "ColumnKeyOfType"
---

> **ColumnKeyOfType**\<`C`, `T`\> = `{ [K in keyof C]: C[K] extends { nullable: true } ? never : Extract<C[K], { type: T }> extends never ? never : K }`\[keyof `C`\] & `string`

## Type Parameters

### C

`C` _extends_ [`Columns`](/api/warehouse-core/src/type-aliases/columns/)

### T

`T` _extends_ [`Column`](/api/warehouse-core/src/type-aliases/column/)\[`"type"`\]
