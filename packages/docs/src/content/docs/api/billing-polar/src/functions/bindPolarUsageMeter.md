---
editUrl: false
next: false
prev: false
title: "bindPolarUsageMeter"
---

> **bindPolarUsageMeter**\<`Meter`\>(`options`): [`PolarUsageMeterBinding`](/api/billing-polar/src/type-aliases/polarusagemeterbinding/)\<`Meter`\>

Binds one typed Croco meter to its pre-declared Polar event and meter. Croco dimension keys are forwarded as
Polar event metadata, so the Polar meter filter can be declared against the same named dimensions.

## Type Parameters

### Meter

`Meter` *extends* [`MeterRef`](/api/metering-core/src/type-aliases/meterref/)

## Parameters

### options

#### eventName

`string`

#### meter

`Meter`

#### providerMeterId

`string`

#### valueMetadataKey?

`string`

## Returns

[`PolarUsageMeterBinding`](/api/billing-polar/src/type-aliases/polarusagemeterbinding/)\<`Meter`\>
