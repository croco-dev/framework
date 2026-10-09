---
editUrl: false
next: false
prev: false
title: "RscSsrCodec"
---

> **RscSsrCodec** = `object`

## Properties

### decodeFlight

> `readonly` **decodeFlight**: (`flight`, `manifest`) => `Promise`\<`unknown`\>

#### Parameters

##### flight

`ReadableStream`\<`Uint8Array`\>

##### manifest

[`RscClientManifestLike`](/api/meta-vite/src/type-aliases/rscclientmanifestlike/)

#### Returns

`Promise`\<`unknown`\>

---

### emptyManifest

> `readonly` **emptyManifest**: () => [`RscClientManifestLike`](/api/meta-vite/src/type-aliases/rscclientmanifestlike/)

#### Returns

[`RscClientManifestLike`](/api/meta-vite/src/type-aliases/rscclientmanifestlike/)

---

### renderHtmlStream

> `readonly` **renderHtmlStream**: (`node`, `options?`) => `Promise`\<`ReadableStream`\<`Uint8Array`\>\>

#### Parameters

##### node

`unknown`

##### options?

[`RscSsrDecodeOptions`](/api/meta-vite/src/type-aliases/rscssrdecodeoptions/)

#### Returns

`Promise`\<`ReadableStream`\<`Uint8Array`\>\>

---

### renderHtmlString

> `readonly` **renderHtmlString**: (`node`) => `string`

#### Parameters

##### node

`unknown`

#### Returns

`string`
