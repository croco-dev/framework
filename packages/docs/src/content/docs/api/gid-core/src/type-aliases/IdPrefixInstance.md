---
editUrl: false
next: false
prev: false
title: "IdPrefixInstance"
---

> **IdPrefixInstance**\<`TPrefix`\> = `object`

Public contract for a single prefixed GID generator and validator.

## Type Parameters

### TPrefix

`TPrefix` _extends_ `string`

## Properties

### Id

> `readonly` **Id**: [`PrefixedId`](/api/gid-core/src/type-aliases/prefixedid/)\<`TPrefix`\>

## Methods

### generate()

> **generate**(): `` `${TPrefix}_${string}` ``

#### Returns

`` `${TPrefix}_${string}` ``

---

### getExpectedLength()

> **getExpectedLength**(): `number`

#### Returns

`number`

---

### getPrefix()

> **getPrefix**(): `TPrefix`

#### Returns

`TPrefix`

---

### validate()

> **validate**(`id`): `` id is `${TPrefix}_${string}` ``

#### Parameters

##### id

`unknown`

#### Returns

`` id is `${TPrefix}_${string}` ``
