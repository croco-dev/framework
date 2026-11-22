---
editUrl: false
next: false
prev: false
title: "RscDocumentRender"
---

> **RscDocumentRender** = `object`

## Properties

### embeddedFlight

> `readonly` **embeddedFlight**: () => `Promise`\<`string`\>

The Flight bytes the HTML was rendered from, base64-encoded, available once the HTML ends.

#### Returns

`Promise`\<`string`\>

---

### html

> `readonly` **html**: `ReadableStream`\<`Uint8Array`\>
