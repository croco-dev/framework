---
editUrl: false
next: false
prev: false
title: "AdminUsageMeter"
---

> **AdminUsageMeter** = `object`

## Properties

### label?

> `readonly` `optional` **label?**: `string`

***

### meterId

> `readonly` **meterId**: `string`

***

### mutability

> `readonly` **mutability**: `"read-only"`

***

### percent?

> `readonly` `optional` **percent?**: `number`

***

### period?

> `readonly` `optional` **period?**: [`AggregationPeriod`](/api/metering-core/src/type-aliases/aggregationperiod/)

***

### quota?

> `readonly` `optional` **quota?**: `number`

***

### remaining?

> `readonly` `optional` **remaining?**: `number`

***

### source

> `readonly` **source**: `"croco"`

***

### state

> `readonly` **state**: `"within-quota"` \| `"over-quota"` \| `"unlimited"`

***

### usage

> `readonly` **usage**: `number`
