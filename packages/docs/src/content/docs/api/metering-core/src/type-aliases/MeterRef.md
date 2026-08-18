---
editUrl: false
next: false
prev: false
title: "MeterRef"
---

> **MeterRef**\<`Key`, `Aggregation`, `Unit`, `Dimensions`, `Billing`\> = `object`

## Type Parameters

### Key

`Key` _extends_ `string` = `string`

### Aggregation

`Aggregation` _extends_ [`MeterAggregation`](/api/metering-core/src/type-aliases/meteraggregation/) = [`MeterAggregation`](/api/metering-core/src/type-aliases/meteraggregation/)

### Unit

`Unit` _extends_ `string` = `string`

### Dimensions

`Dimensions` _extends_ [`MeterDimensionSchema`](/api/metering-core/src/type-aliases/meterdimensionschema/) = [`MeterDimensionSchema`](/api/metering-core/src/type-aliases/meterdimensionschema/)

### Billing

`Billing` _extends_ [`MeterBillingIntent`](/api/metering-core/src/type-aliases/meterbillingintent/) = [`MeterBillingIntent`](/api/metering-core/src/type-aliases/meterbillingintent/)

## Properties

### \[METER_REF_BRAND\]

> `readonly` **\[METER_REF_BRAND\]**: `true`

---

### aggregation

> `readonly` **aggregation**: `Aggregation`

---

### billing

> `readonly` **billing**: `Billing`

---

### dimensions

> `readonly` **dimensions**: `Dimensions`

---

### key

> `readonly` **key**: `Key`

---

### unit

> `readonly` **unit**: `Unit`
