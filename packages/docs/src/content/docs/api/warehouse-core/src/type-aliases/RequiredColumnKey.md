---
editUrl: false
next: false
prev: false
title: "RequiredColumnKey"
---

> **RequiredColumnKey**\<`C`\> = `{ [K in keyof C]: C[K] extends { nullable: true } ? never : K }`\[keyof `C`\] & `string`

## Type Parameters

### C

`C` _extends_ [`Columns`](/api/warehouse-core/src/type-aliases/columns/)
