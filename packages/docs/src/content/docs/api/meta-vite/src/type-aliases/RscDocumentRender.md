---
editUrl: false
next: false
prev: false
title: "RscDocumentRender"
---

> **RscDocumentRender** = `object`

## Properties

### html

> `readonly` **html**: `ReadableStream`\<`Uint8Array`\>

The document body. The Flight bytes the HTML is rendered from are written
into it as they arrive, so the browser can hydrate before it ends.
