---
editUrl: false
next: false
prev: false
title: "IdPrefixRegistry"
---

> **IdPrefixRegistry**\<`T`\> = `{ [K in keyof T]: IdPrefixInstance<T[K]> }`

Registry shape returned from [defineIdPrefixes](/api/gid-core/src/functions/defineidprefixes/).

## Type Parameters

### T

`T` *extends* `Record`\<`string`, `string`\>
