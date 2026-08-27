---
editUrl: false
next: false
prev: false
title: "createCursorCodec"
---

> **createCursorCodec**\<`TSchema`\>(`schema`): [`CursorCodec`](/api/pagination-core/src/type-aliases/cursorcodec/)\<`TSchema`\>

Create a typed cursor codec backed by a Zod schema.

The schema must include the common `v` and `id` fields, and its wire input must survive a JSON
roundtrip without loss. Use `z.codec(z.iso.datetime(), z.date(), ...)` for Date outputs and other
bidirectional transforms so encoding produces JSON-safe wire values.

## Type Parameters

### TSchema

`TSchema` _extends_ `ZodType`\<`CursorBasePayload`, `CursorBasePayload`, `$ZodTypeInternals`\<`CursorBasePayload`, `CursorBasePayload`\>\>

## Parameters

### schema

`TSchema`

## Returns

[`CursorCodec`](/api/pagination-core/src/type-aliases/cursorcodec/)\<`TSchema`\>
