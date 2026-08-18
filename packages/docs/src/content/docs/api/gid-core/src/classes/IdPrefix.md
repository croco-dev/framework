---
editUrl: false
next: false
prev: false
title: "IdPrefix"
---

Generates and validates GIDs for a specific prefix.

## Type Parameters

### TPrefix

`TPrefix` _extends_ `string` = `string`

## Constructors

### Constructor

> **new IdPrefix**\<`TPrefix`\>(`prefix`): `IdPrefix`\<`TPrefix`\>

#### Parameters

##### prefix

`TPrefix`

#### Returns

`IdPrefix`\<`TPrefix`\>

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

---

### getLength()

> `static` **getLength**(`prefixLength?`): `number`

#### Parameters

##### prefixLength?

`number` = `MINIMUM_PREFIX_LENGTH`

#### Returns

`number`
