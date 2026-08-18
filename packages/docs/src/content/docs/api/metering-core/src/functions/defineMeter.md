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

`Key` _extends_ `string`

### Aggregation

`Aggregation` _extends_ [`MeterAggregation`](/api/metering-core/src/type-aliases/meteraggregation/)

### Unit

`Unit` _extends_ `string`

### Dimensions

`Dimensions` _extends_ `Readonly`\<`Record`\<`string`, [`EnumDimension`](/api/metering-core/src/type-aliases/enumdimension/)\<[`NonEmptyMeterDimensionValues`](/api/metering-core/src/type-aliases/nonemptymeterdimensionvalues/)\>\>\> = `Record`\<`never`, `never`\>

### Billing

`Billing` _extends_ [`MeterBillingIntent`](/api/metering-core/src/type-aliases/meterbillingintent/) = `"local"`

## Parameters

### options

[`MeterDefinitionOptions`](/api/metering-core/src/type-aliases/meterdefinitionoptions/)\<`Key`, `Aggregation`, `Unit`, `Dimensions`, `Billing`\>

## Returns

[`MeterRef`](/api/metering-core/src/type-aliases/meterref/)\<`Key`, `Aggregation`, `Unit`, `Dimensions`, `Billing`\>
