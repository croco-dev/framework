---
editUrl: false
next: false
prev: false
title: "RscSsrEntry"
---

> **RscSsrEntry** = `object`

## Properties

### clientEntryUrl

> `readonly` **clientEntryUrl**: `string`

Browser URL of the client entry this SSR build was compiled against.

---

### renderHtml

> `readonly` **renderHtml**: (`input`) => `Promise`\<`ReadableStream`\<`Uint8Array`\>\>

#### Parameters

##### input

[`RscHtmlRenderInput`](/api/meta-vite/src/type-aliases/rschtmlrenderinput/)

#### Returns

`Promise`\<`ReadableStream`\<`Uint8Array`\>\>

---

### version

> `readonly` **version**: _typeof_ `RSC_SSR_ENTRY_VERSION`
