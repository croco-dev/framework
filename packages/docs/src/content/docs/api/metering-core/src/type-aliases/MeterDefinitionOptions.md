---
editUrl: false
next: false
prev: false
title: "MeterDefinitionOptions"
---

> **MeterDefinitionOptions**\<`Key`, `Aggregation`, `Unit`, `Dimensions`, `Billing`\> = `object`

## Type Parameters

### Key

`Key` *extends* `string`

### Aggregation

`Aggregation` *extends* [`MeterAggregation`](/api/metering-core/src/type-aliases/meteraggregation/)

### Unit

`Unit` *extends* `string`

### Dimensions

`Dimensions` *extends* [`MeterDimensionSchema`](/api/metering-core/src/type-aliases/meterdimensionschema/)

### Billing

`Billing` *extends* [`MeterBillingIntent`](/api/metering-core/src/type-aliases/meterbillingintent/)

## Properties

### aggregation

> `readonly` **aggregation**: `Aggregation`

***

### billing?

> `readonly` `optional` **billing?**: `Billing`

***

### dimensions?

> `readonly` `optional` **dimensions?**: `Dimensions`

***

### key

> `readonly` **key**: `Key`

***

### unit

> `readonly` **unit**: `Unit`
