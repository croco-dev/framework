---
editUrl: false
next: false
prev: false
title: "ModuleContribution"
---

> **ModuleContribution**\<`T`, `TKind`\> = `object`

## Type Parameters

### T

`T` = `unknown`

### TKind

`TKind` _extends_ `string` = `string`

## Properties

### id

> `readonly` **id**: `string`

Stable identity within one contribution kind. Distinct modules may not reuse it.

---

### kind

> `readonly` **kind**: `TKind`

Typed aggregation surface owned by the consuming package.

---

### order?

> `readonly` `optional` **order?**: `number`

Lower values run or render first. Equal values are ordered by id, then module name.

---

### value

> `readonly` **value**: `T`
