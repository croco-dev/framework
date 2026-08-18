---
editUrl: false
next: false
prev: false
title: "DatabaseClient"
---

> **DatabaseClient** = `object`

## Properties

### execute

> **execute**: (`query`) => `Promise`\<`unknown`\>

#### Parameters

##### query

`unknown`

#### Returns

`Promise`\<`unknown`\>

---

### transaction?

> `optional` **transaction?**: \<`T`\>(`fn`) => `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

(`tx`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
