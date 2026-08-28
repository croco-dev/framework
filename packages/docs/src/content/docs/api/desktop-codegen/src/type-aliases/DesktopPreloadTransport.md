---
editUrl: false
next: false
prev: false
title: "DesktopPreloadTransport"
---

> **DesktopPreloadTransport** = `object`

## Methods

### invoke()

> **invoke**(`commandId`, `input`): `Promise`\<`unknown`\>

#### Parameters

##### commandId

`string`

##### input

`unknown`

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
