---
editUrl: false
next: false
prev: false
title: "BatchLoadOptions"
---

> **BatchLoadOptions**\<`TRepository`\> = `object`

## Type Parameters

### TRepository

`TRepository` *extends* `object` = `object`

## Properties

### by

> **by**: `string`

The field name to use as the key for mapping results.
This is required to ensure the order of results matches the order of keys.
Example: 'id'

***

### name?

> `optional` **name?**: `string`

The name of the DataLoader.
If not provided, it defaults to `${ClassName}:${methodName}`.

***

### scope?

> `optional` **scope?**: [`BatchLoadScopeResolver`](/api/repository-core/src/type-aliases/batchloadscoperesolver/)\<`TRepository`\>

Resolves the repository, tenant, data source, or transaction identity that may safely share
one request-scoped loader. The receiver instance is used when this option is omitted.
