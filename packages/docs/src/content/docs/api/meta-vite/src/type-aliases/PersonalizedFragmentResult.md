---
editUrl: false
next: false
prev: false
title: "PersonalizedFragmentResult"
---

> **PersonalizedFragmentResult**\<`TPublic`, `TVariant`, `TPrivate`\> = `object`

## Type Parameters

### TPublic

`TPublic`

### TVariant

`TVariant`

### TPrivate

`TPrivate`

## Properties

### cache

> `readonly` **cache**: `object`

#### publicKeyHash

> `readonly` **publicKeyHash**: `string`

#### publicSource

> `readonly` **publicSource**: `"cache"` \| `"render"`

#### variantKeyHash

> `readonly` **variantKeyHash**: `string` \| `undefined`

#### variantSource

> `readonly` **variantSource**: `"cache"` \| `"render"` \| `"absent"`

---

### privateValue

> `readonly` **privateValue**: `TPrivate`

---

### public

> `readonly` **public**: `TPublic`

---

### variant

> `readonly` **variant**: `TVariant` \| `undefined`
