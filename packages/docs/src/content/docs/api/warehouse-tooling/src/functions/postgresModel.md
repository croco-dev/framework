---
editUrl: false
next: false
prev: false
title: "postgresModel"
---

> **postgresModel**(`fact`, `options`): [`ModelBinding`](/api/warehouse-tooling/src/type-aliases/modelbinding/)

## Parameters

### fact

[`FactDeclaration`](/api/warehouse-core/src/type-aliases/factdeclaration/)

### options

`Omit`\<`Extract`\<[`ModelBinding`](/api/warehouse-tooling/src/type-aliases/modelbinding/), \{ `backend`: `"postgres"`; \}\>, `"backend"` \| `"fact"`\>

## Returns

[`ModelBinding`](/api/warehouse-tooling/src/type-aliases/modelbinding/)
