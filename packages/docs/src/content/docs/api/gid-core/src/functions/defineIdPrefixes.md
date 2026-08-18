---
editUrl: false
next: false
prev: false
title: "defineIdPrefixes"
---

> **defineIdPrefixes**\<`T`\>(`config`): [`IdPrefixRegistry`](/api/gid-core/src/type-aliases/idprefixregistry/)\<`T`\>

Creates a type-safe registry for generating and validating prefixed GIDs.

## Type Parameters

### T

`T` _extends_ `Record`\<`string`, `string`\>

## Parameters

### config

`T` & `AssertNoDuplicateValues`\<`T`\>

## Returns

[`IdPrefixRegistry`](/api/gid-core/src/type-aliases/idprefixregistry/)\<`T`\>
