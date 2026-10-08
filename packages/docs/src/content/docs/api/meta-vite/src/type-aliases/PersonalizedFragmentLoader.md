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

Fragment bytes must be the JSON serialization of `value`: cache hits
rehydrate with `JSON.parse(bytes)`, so HTML or other non-JSON payloads
are rejected with a registered Problem instead of parsed.

#### Returns

`Promise`\<\{ `bytes`: `string`; `value`: `T`; \}\>

---

### zone

> `readonly` **zone**: `Exclude`\<[`PersonalizedCacheZone`](/api/cache-core/src/type-aliases/personalizedcachezone/), `"private"`\>
