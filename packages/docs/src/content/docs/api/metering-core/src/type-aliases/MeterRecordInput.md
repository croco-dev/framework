---
editUrl: false
next: false
prev: false
title: "MeterRecordInput"
---

> **MeterRecordInput**\<`TMeter`\> = `object` & `MeterValueInput`\<[`MeterAggregationOf`](/api/metering-core/src/type-aliases/meteraggregationof/)\<`TMeter`\>\> & `MeterEventInput`\<[`MeterBillingOf`](/api/metering-core/src/type-aliases/meterbillingof/)\<`TMeter`\>\> & `MeterDimensionsInput`\<[`MeterDimensionsOf`](/api/metering-core/src/type-aliases/meterdimensionsof/)\<`TMeter`\>\>

## Type Declaration

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

### tenantId

> `readonly` **tenantId**: `string`

## Type Parameters

### TMeter

`TMeter` _extends_ [`MeterRef`](/api/metering-core/src/type-aliases/meterref/)
