---
editUrl: false
next: false
prev: false
title: "readRscInitialFlight"
---

> **readRscInitialFlight**(`doc?`): `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> \| `null`

The Flight payload the current document was rendered from, as the stream the
official browser decoder reads. Returns null when the document carries none,
and the caller then fetches the route's Flight representation instead.

## Parameters

### doc?

`Pick`\<[`RscManifestDocument`](/api/meta-vite/src/type-aliases/rscmanifestdocument/), `"getElementById"`\>

## Returns

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\> \| `null`
