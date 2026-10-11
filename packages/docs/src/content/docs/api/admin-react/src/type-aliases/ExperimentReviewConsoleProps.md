---
editUrl: false
next: false
prev: false
title: "ExperimentReviewConsoleProps"
---

> **ExperimentReviewConsoleProps** = `object`

## Properties

### onAction?

> `readonly` `optional` **onAction?**: (`action`) => `void`

#### Parameters

##### action

[`ExperimentReviewAction`](/api/admin-core/src/type-aliases/experimentreviewaction/)

#### Returns

`void`

---

### onPageChange?

> `readonly` `optional` **onPageChange?**: (`cursor`) => `void`

#### Parameters

##### cursor

`string` \| `null`

#### Returns

`void`

---

### onRefresh?

> `readonly` `optional` **onRefresh?**: () => `void`

#### Returns

`void`

---

### onSelectVariant?

> `readonly` `optional` **onSelectVariant?**: (`variantId`) => `void`

#### Parameters

##### variantId

`string`

#### Returns

`void`

---

### selectedVariantId?

> `readonly` `optional` **selectedVariantId?**: `string`

---

### state

> `readonly` **state**: [`ExperimentReviewConsoleState`](/api/admin-core/src/type-aliases/experimentreviewconsolestate/)

---

### unitPage?

> `readonly` `optional` **unitPage?**: [`ExperimentReviewUnitPage`](/api/admin-core/src/type-aliases/experimentreviewunitpage/)
