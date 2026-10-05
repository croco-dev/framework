---
editUrl: false
next: false
prev: false
title: "createDeferredRegionStore"
---

> **createDeferredRegionStore**(`regions`, `signal`, `regionTimeoutMs`, `input?`): `object`

## Parameters

### regions

readonly [`DeferredRegionDefinition`](/api/meta-vite/src/type-aliases/deferredregiondefinition/)[]

### signal

`AbortSignal`

### regionTimeoutMs

`number`

### input?

`Omit`\<[`DeferredRegionLoaderInput`](/api/meta-vite/src/type-aliases/deferredregionloaderinput/), `"signal"`\>

## Returns

`object`

### reader

> `readonly` **reader**: [`DeferredRegionReader`](/api/meta-vite/src/type-aliases/deferredregionreader/)

### settle

> `readonly` **settle**: () => `Promise`\<`RegionSettleCounts`\>

#### Returns

`Promise`\<`RegionSettleCounts`\>
