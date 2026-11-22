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

The Flight payload the HTML was rendered from, available once the HTML ends.

#### Returns

`Promise`\<`string`\>

---

### html

> `readonly` **html**: `ReadableStream`\<`Uint8Array`\>
