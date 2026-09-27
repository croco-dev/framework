---
editUrl: false
next: false
prev: false
title: "FactOptions"
---

> **FactOptions**\<`C`\> = `object` & \{ `aggregate?`: `never`; `kind`: `"transaction"`; `time`: \{ `event`: [`ColumnKeyOfType`](/api/warehouse-core/src/type-aliases/columnkeyoftype/)\<`C`, `"instant"`\>; \}; `write`: \{ `conflict`: `"reject"`; `duplicate`: `"ignore-identical"`; `mode`: `"append"`; \}; \} \| \{ `aggregate`: \{ `date`: [`ColumnKeyOfType`](/api/warehouse-core/src/type-aliases/columnkeyoftype/)\<`C`, `"date"`\>; `dimensions`: readonly [`RequiredColumnKey`](/api/warehouse-core/src/type-aliases/requiredcolumnkey/)\<`C`\>[]; `measures`: `Readonly`\<`Partial`\<`Record`\<`MeasureKey`\<`C`\>, [`Measure`](/api/warehouse-core/src/type-aliases/measure/)\>\>\>; `series`: readonly [`RequiredColumnKey`](/api/warehouse-core/src/type-aliases/requiredcolumnkey/)\<`C`\>[]; \}; `kind`: `"aggregate"`; `time`: \{ `event`: [`ColumnKeyOfType`](/api/warehouse-core/src/type-aliases/columnkeyoftype/)\<`C`, `"date"`\>; \}; `write`: \{ `conflict`: `"reject"`; `duplicate`: `"ignore-identical"`; `mode`: `"replace-range"`; \}; \}

## Type Declaration

### columns

> `readonly` **columns**: `C`

### description?

> `readonly` `optional` **description?**: `string`

### grain

> `readonly` **grain**: `object`

#### grain.description

> `readonly` **description**: `string`

#### grain.key

> `readonly` **key**: readonly [`RequiredColumnKey`](/api/warehouse-core/src/type-aliases/requiredcolumnkey/)\<`C`\>[]

### policyRefs?

> `readonly` `optional` **policyRefs?**: readonly `string`[]

### scope

> `readonly` **scope**: `"tenant"` \| `"application"`

### sourceRefs?

> `readonly` `optional` **sourceRefs?**: readonly `string`[]

### version

> `readonly` **version**: `number`

## Type Parameters

### C

`C` _extends_ [`Columns`](/api/warehouse-core/src/type-aliases/columns/) = [`Columns`](/api/warehouse-core/src/type-aliases/columns/)
