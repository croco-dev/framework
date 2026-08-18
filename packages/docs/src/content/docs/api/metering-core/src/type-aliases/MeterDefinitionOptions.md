---
editUrl: false
next: false
prev: false
title: "MeterDefinitionOptions"
---

> **MeterDefinitionOptions**\<`Key`, `Aggregation`, `Unit`, `Dimensions`, `Billing`\> = `object`

## Type Parameters

### Key

`Key` _extends_ `string`

### Aggregation

`Aggregation` _extends_ [`MeterAggregation`](/api/metering-core/src/type-aliases/meteraggregation/)

### Unit

`Unit` _extends_ `string`

### Dimensions

`Dimensions` _extends_ [`MeterDimensionSchema`](/api/metering-core/src/type-aliases/meterdimensionschema/)

### Billing

`Billing` _extends_ [`MeterBillingIntent`](/api/metering-core/src/type-aliases/meterbillingintent/)

## Properties

### aggregation

> `readonly` **aggregation**: `Aggregation`

---

### billing?

> `readonly` `optional` **billing?**: `Billing`

---

### dimensions?

> `readonly` `optional` **dimensions?**: `Dimensions`

---

### key

> `readonly` **key**: `Key`

---

### unit

> `readonly` **unit**: `Unit`
