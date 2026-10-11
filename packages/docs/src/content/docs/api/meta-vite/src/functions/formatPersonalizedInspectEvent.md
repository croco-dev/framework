---
editUrl: false
next: false
prev: false
title: "formatPersonalizedInspectEvent"
---

> **formatPersonalizedInspectEvent**(`event`): `string`

Render one inspect event as a single PII-safe line for API/CLI output.
Only key hashes, counts, allow-listed names, revisions, and reasons appear;
raw keys, dimension values, and private payloads never appear.

## Parameters

### event

[`PersonalizedFragmentInspectEvent`](/api/meta-vite/src/type-aliases/personalizedfragmentinspectevent/)

## Returns

`string`
