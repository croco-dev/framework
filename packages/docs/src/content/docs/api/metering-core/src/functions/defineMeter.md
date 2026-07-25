---
editUrl: false
next: false
prev: false
title: "defineMeter"
---

> **defineMeter**\<`Key`, `Aggregation`, `Unit`, `Dimensions`, `Billing`\>(`options`): [`MeterRef`](/api/metering-core/src/type-aliases/meterref/)\<`Key`, `Aggregation`, `Unit`, `Dimensions`, `Billing`\>

Defines an inspectable, serializable usage meter while retaining literal keys and dimensions.

## Type Parameters

### Key

`Key` *extends* `string`

### Aggregation

`Aggregation` *extends* [`MeterAggregation`](/api/metering-core/src/type-aliases/meteraggregation/)

### Unit

`Unit` *extends* `string`

### Dimensions

`Dimensions` *extends* `Readonly`\<`Record`\<`string`, [`EnumDimension`](/api/metering-core/src/type-aliases/enumdimension/)\<readonly \[[`MeterDimensionValue`](/api/metering-core/src/type-aliases/meterdimensionvalue/), [`MeterDimensionValue`](/api/metering-core/src/type-aliases/meterdimensionvalue/)\]\>\>\> = `Record`\<`never`, `never`\>

### Billing

`Billing` *extends* [`MeterBillingIntent`](/api/metering-core/src/type-aliases/meterbillingintent/) = `"local"`

## Parameters

### options

[`MeterDefinitionOptions`](/api/metering-core/src/type-aliases/meterdefinitionoptions/)\<`Key`, `Aggregation`, `Unit`, `Dimensions`, `Billing`\>

## Returns

[`MeterRef`](/api/metering-core/src/type-aliases/meterref/)\<`Key`, `Aggregation`, `Unit`, `Dimensions`, `Billing`\>
