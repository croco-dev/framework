---
editUrl: false
next: false
prev: false
title: "CursorCodec"
---

> **CursorCodec**\<`TSchema`\> = `object`

## Type Parameters

### TSchema

`TSchema` _extends_ `z.ZodType`\<`CursorBasePayload`, `CursorBasePayload`\>

## Methods

### decode()

> **decode**(`cursor`): `output`\<`TSchema`\>

Decode and validate a versioned cursor as the schema output.

#### Parameters

##### cursor

`string`

#### Returns

`output`\<`TSchema`\>

---

### encode()

> **encode**(`payload`): `string`

Encode a schema output as a versioned URL-safe Base64 cursor.

#### Parameters

##### payload

`output`\<`TSchema`\>

#### Returns

`string`
