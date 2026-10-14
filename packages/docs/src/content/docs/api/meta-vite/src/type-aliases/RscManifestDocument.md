---
editUrl: false
next: false
prev: false
title: "RscManifestDocument"
---

> **RscManifestDocument** = `object`

The document lookups `createRscBrowserFlightHeaders` needs. Declared
structurally so the browser path can be tested without a DOM
implementation.

## Properties

### location?

> `optional` **location?**: `object`

#### pathname

> **pathname**: `string`

## Methods

### getElementById()

> **getElementById**(`id`): \{ `textContent`: `string` \| `null`; \} \| `null`

#### Parameters

##### id

`string`

#### Returns

\{ `textContent`: `string` \| `null`; \} \| `null`

---

### querySelector()

> **querySelector**(`selector`): \{ `getAttribute`: `string` \| `null`; \} \| `null`

#### Parameters

##### selector

`string`

#### Returns

\{ `getAttribute`: `string` \| `null`; \} \| `null`
