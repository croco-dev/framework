---
editUrl: false
next: false
prev: false
title: "InferRouteSchemaRequest"
---

> **InferRouteSchemaRequest**\<`T`\> = `{ readonly [Key in keyof T["request"]]: InferSchemaOutput<T["request"][Key]> }`

## Type Parameters

### T

`T` _extends_ [`DefinedRouteSchema`](/api/protocols-core/src/type-aliases/definedrouteschema/)
