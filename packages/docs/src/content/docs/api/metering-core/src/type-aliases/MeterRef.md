---
editUrl: false
next: false
prev: false
title: "MeterRef"
---

> **MeterRef**\<`Key`, `Aggregation`, `Unit`, `Dimensions`, `Billing`\> = `object`

## Type Parameters

### Key

`Key` *extends* `string` = `string`

### Aggregation

`Aggregation` *extends* [`MeterAggregation`](/api/metering-core/src/type-aliases/meteraggregation/) = [`MeterAggregation`](/api/metering-core/src/type-aliases/meteraggregation/)

### Unit

`Unit` *extends* `string` = `string`

### Dimensions

`Dimensions` *extends* [`MeterDimensionSchema`](/api/metering-core/src/type-aliases/meterdimensionschema/) = [`MeterDimensionSchema`](/api/metering-core/src/type-aliases/meterdimensionschema/)

### Billing

`Billing` *extends* [`MeterBillingIntent`](/api/metering-core/src/type-aliases/meterbillingintent/) = [`MeterBillingIntent`](/api/metering-core/src/type-aliases/meterbillingintent/)

## Properties

### \[METER\_REF\_BRAND\]

> `readonly` **\[METER\_REF\_BRAND\]**: `true`

***

### aggregation

> `readonly` **aggregation**: `Aggregation`

***

### billing

> `readonly` **billing**: `Billing`

***

### dimensions

> `readonly` **dimensions**: `Dimensions`

***

### key

> `readonly` **key**: `Key`

***

### unit

> `readonly` **unit**: `Unit`
