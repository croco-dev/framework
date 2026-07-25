---
editUrl: false
next: false
prev: false
title: "MeterDescriptor"
---

> **MeterDescriptor**\<`TKey`, `TAggregation`, `TUnit`, `TDimensions`, `TBilling`\> = `object`

## Type Parameters

### TKey

`TKey` _extends_ `string` = `string`

### TAggregation

`TAggregation` _extends_ [`MeterAggregation`](/api/metering-core/src/type-aliases/meteraggregation/) = [`MeterAggregation`](/api/metering-core/src/type-aliases/meteraggregation/)

### TUnit

`TUnit` _extends_ `string` = `string`

### TDimensions

`TDimensions` _extends_ [`MeterDimensionSchema`](/api/metering-core/src/type-aliases/meterdimensionschema/) = [`MeterDimensionSchema`](/api/metering-core/src/type-aliases/meterdimensionschema/)

### TBilling

`TBilling` _extends_ [`MeterBillingIntent`](/api/metering-core/src/type-aliases/meterbillingintent/) = [`MeterBillingIntent`](/api/metering-core/src/type-aliases/meterbillingintent/)

## Properties

### aggregation

> `readonly` **aggregation**: `TAggregation`

---

### billing

> `readonly` **billing**: `TBilling`

---

### dimensions

> `readonly` **dimensions**: `TDimensions`

---

### key

> `readonly` **key**: `TKey`

---

### unit

> `readonly` **unit**: `TUnit`
