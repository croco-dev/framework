---
editUrl: false
next: false
prev: false
title: "defineMeter"
---

> **defineMeter**\<`TKey`, `TAggregation`, `TUnit`, `TDimensions`, `TBilling`\>(`definition`): [`MeterRef`](/api/metering-core/src/type-aliases/meterref/)\<`TKey`, `TAggregation`, `TUnit`, `TDimensions`, `TBilling`\>

Definition-first meter helpers and deterministic meter descriptors.

## Type Parameters

### TKey

`TKey` _extends_ `string`

### TAggregation

`TAggregation` _extends_ [`MeterAggregation`](/api/metering-core/src/type-aliases/meteraggregation/)

### TUnit

`TUnit` _extends_ `string`

### TDimensions

`TDimensions` _extends_ `Readonly`\<`Record`\<`string`, [`MeterDimension`](/api/metering-core/src/type-aliases/meterdimension/)\>\>

### TBilling

`TBilling` _extends_ [`MeterBillingIntent`](/api/metering-core/src/type-aliases/meterbillingintent/)

## Parameters

### definition

[`MeterDefinitionInput`](/api/metering-core/src/type-aliases/meterdefinitioninput/)\<`TKey`, `TAggregation`, `TUnit`, `TDimensions`, `TBilling`\>

## Returns

[`MeterRef`](/api/metering-core/src/type-aliases/meterref/)\<`TKey`, `TAggregation`, `TUnit`, `TDimensions`, `TBilling`\>

## Description

`defineMeter` preserves literal meter keys, aggregations, billing intent, and declared dimension domains.
The returned branded `MeterRef` can be passed to `MeteringService.record`.
