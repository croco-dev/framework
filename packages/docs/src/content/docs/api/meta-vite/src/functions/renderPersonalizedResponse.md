---
editUrl: false
next: false
prev: false
title: "renderPersonalizedResponse"
---

> **renderPersonalizedResponse**\<`TPublic`, `TVariant`, `TPrivate`\>(`input`): `object`

Compose a personalized response from already-resolved fragment inputs.
Private input is branded so public values cannot flow into it by accident.
Callers must send the result with a non-cacheable response signal
(`Cache-Control: private, no-store` or an identity `Vary`); composed
bodies combine shared fragments with request-local values and this
helper has no shared-cache handle, so it cannot enforce that marking.

## Type Parameters

### TPublic

`TPublic`

### TVariant

`TVariant`

### TPrivate

`TPrivate`

## Parameters

### input

#### deployId

`string`

#### fragments

[`PersonalizedRenderInput`](/api/meta-vite/src/type-aliases/personalizedrenderinput/)\<`TPublic`, `TVariant`, `TPrivate`\>

#### render

(`fragments`) => `string`

#### representation

`"html"` \| `"flight"`

## Returns

`object`

### body

> `readonly` **body**: `string`

### deployId

> `readonly` **deployId**: `string`

### representation

> `readonly` **representation**: `"html"` \| `"flight"`
