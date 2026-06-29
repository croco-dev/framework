---
editUrl: false
next: false
prev: false
title: "ItemProcessor"
---

## Type Parameters

### I

`I`

### O

`O`

## Methods

### process()

> **process**(`item`): `Promise`\<`O` \| `null`\>

Process the input item and return a modified item.
Returns null if the item should be filtered out.

#### Parameters

##### item

`I`

#### Returns

`Promise`\<`O` \| `null`\>
