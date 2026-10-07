---
editUrl: false
next: false
prev: false
title: "DeferredRegionReader"
---

> **DeferredRegionReader** = `object`

Per-request deferred region store.
RenderServer creates one store per request and passes its reader through
component props, so parallel fetches and cancellation never mix tenant,
auth, or request data across concurrent requests.

## Properties

### signal

> `readonly` **signal**: `AbortSignal`

## Methods

### readRegion()

> **readRegion**(`id`): `Promise`\<`unknown`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`unknown`\>
