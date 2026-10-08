---
editUrl: false
next: false
prev: false
title: "PersonalizedFragmentLoader"
---

> **PersonalizedFragmentLoader**\<`T`\> = `object`

## Type Parameters

### T

`T`

## Properties

### domain?

> `readonly` `optional` **domain?**: `string`

---

### load

> `readonly` **load**: () => `Promise`\<\{ `bytes`: `string`; `value`: `T`; \}\>

#### Returns

`Promise`\<\{ `bytes`: `string`; `value`: `T`; \}\>

---

### zone

> `readonly` **zone**: `Exclude`\<[`PersonalizedCacheZone`](/api/cache-core/src/type-aliases/personalizedcachezone/), `"private"`\>
