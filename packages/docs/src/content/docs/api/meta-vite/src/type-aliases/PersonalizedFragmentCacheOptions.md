---
editUrl: false
next: false
prev: false
title: "PersonalizedFragmentCacheOptions"
---

> **PersonalizedFragmentCacheOptions**\<`TPublic`, `TVariant`, `TPrivate`\> = `object`

## Type Parameters

### TPublic

`TPublic`

### TVariant

`TVariant`

### TPrivate

`TPrivate`

## Properties

### allowedVariants?

> `readonly` `optional` **allowedVariants?**: readonly `string`[]

Explicit variant allow-list resolved by a trusted server decision.

---

### authorization?

> `readonly` `optional` **authorization?**: (`input`) => `boolean` \| `Promise`\<`boolean`\>

Per-request access check; denial bypasses shared caches without caching.

#### Parameters

##### input

###### zone

[`PersonalizedCacheZone`](/api/cache-core/src/type-aliases/personalizedcachezone/)

#### Returns

`boolean` \| `Promise`\<`boolean`\>

---

### inspect?

> `readonly` `optional` **inspect?**: (`event`) => `void`

#### Parameters

##### event

[`PersonalizedFragmentInspectEvent`](/api/meta-vite/src/type-aliases/personalizedfragmentinspectevent/)

#### Returns

`void`

---

### now?

> `readonly` `optional` **now?**: () => `number`

#### Returns

`number`

---

### policy

> `readonly` **policy**: [`PersonalizedCachePolicy`](/api/cache-core/src/type-aliases/personalizedcachepolicy/)

---

### privateLoader

> `readonly` **privateLoader**: [`PersonalizedPrivateLoader`](/api/meta-vite/src/type-aliases/personalizedprivateloader/)\<`TPrivate`\>

---

### publicLoader

> `readonly` **publicLoader**: [`PersonalizedFragmentLoader`](/api/meta-vite/src/type-aliases/personalizedfragmentloader/)\<`TPublic`\>

---

### representation?

> `readonly` `optional` **representation?**: `"html"` \| `"flight"`

Final representation scope: html and flight fragments never share keys.

---

### signal?

> `readonly` `optional` **signal?**: `AbortSignal`

---

### store

> `readonly` **store**: [`PersonalizedFragmentStore`](/api/meta-vite/src/type-aliases/personalizedfragmentstore/)

---

### variantLoader?

> `readonly` `optional` **variantLoader?**: [`PersonalizedFragmentLoader`](/api/meta-vite/src/type-aliases/personalizedfragmentloader/)\<`TVariant`\>
