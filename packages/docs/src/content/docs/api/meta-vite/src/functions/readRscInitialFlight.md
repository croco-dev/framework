---
editUrl: false
next: false
prev: false
title: "readRscInitialFlight"
---

> **readRscInitialFlight**(`doc?`): `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> \| `null`

The Flight payload the current document is rendered from, as the stream the
official browser decoder reads. The stream yields each block as soon as the
parser has it, so the shell can hydrate while later rows are still on their
way, and closes at the block that ends the payload. Returns null when the
document carries no streamed payload; the caller then fetches the route's
Flight representation instead.

## Parameters

### doc?

`Document`

## Returns

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> \| `null`
