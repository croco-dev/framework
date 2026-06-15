---
editUrl: false
next: false
prev: false
title: "createBatchLoader"
---

> **createBatchLoader**\<`K`, `V`\>(`options`): [`BatchLoader`](/api/dataloader-core/src/interfaces/batchloader/)\<`K`, `V`\>

Creates a factory that returns a BatchLoader instance.
The instance is scoped to the current request context using AsyncLocalStorage.

## Type Parameters

### K

`K`

### V

`V`

## Parameters

### options

[`BatchLoaderOptions`](/api/dataloader-core/src/type-aliases/batchloaderoptions/)\<`K`, `V`\>

Configuration options for the BatchLoader

## Returns

[`BatchLoader`](/api/dataloader-core/src/interfaces/batchloader/)\<`K`, `V`\>

An object with the same interface as BatchLoader, but delegating to a context-scoped instance
