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

## Methods

### generate()

> **generate**(): [`PrefixedId`](/api/gid-core/src/type-aliases/prefixedid/)\<`TPrefix`\>

#### Returns

[`PrefixedId`](/api/gid-core/src/type-aliases/prefixedid/)\<`TPrefix`\>

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

> **validate**(`id`): `id is PrefixedId<TPrefix>`

#### Parameters

##### id

`unknown`

#### Returns

`id is PrefixedId<TPrefix>`
