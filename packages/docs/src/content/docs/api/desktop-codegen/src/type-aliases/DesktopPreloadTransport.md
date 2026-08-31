---
editUrl: false
next: false
prev: false
title: "DesktopPreloadTransport"
---

> **DesktopPreloadTransport** = `object`

## Methods

### invoke()

> **invoke**(`commandId`, `input`, `options`): `Promise`\<`unknown`\>

#### Parameters

##### commandId

`string`

##### input

`unknown`

##### options

[`DesktopPreloadCommandOptions`](/api/desktop-codegen/src/type-aliases/desktoppreloadcommandoptions/)

#### Returns

`Promise`\<`unknown`\>

---

### subscribe()

> **subscribe**(`eventId`, `callback`): () => `void`

#### Parameters

##### eventId

`string`

##### callback

(`payload`) => `void`

#### Returns

() => `void`
