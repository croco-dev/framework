---
editUrl: false
next: false
prev: false
title: "IdOf"
---

> **IdOf**\<`TEntry`\> = `TEntry` _extends_ [`IdPrefixInstance`](/api/gid-core/src/type-aliases/idprefixinstance/)\<infer TPrefix\> ? [`PrefixedId`](/api/gid-core/src/type-aliases/prefixedid/)\<`TPrefix`\> : `never`

Extracts the branded GID type from an entry returned by [defineIdPrefixes](/api/gid-core/src/functions/defineidprefixes/).

## Type Parameters

### TEntry

`TEntry` _extends_ [`IdPrefixInstance`](/api/gid-core/src/type-aliases/idprefixinstance/)\<`string`\>
