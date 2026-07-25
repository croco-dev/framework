---
editUrl: false
next: false
prev: false
title: "isMeterRef"
---

> **isMeterRef**(`value`): `value is MeterRef<string, MeterAggregation, string, Readonly<Record<string, MeterDimension>>, MeterBillingIntent>`

Definition-first meter helpers and deterministic meter descriptors.

## Parameters

### value

`unknown`

## Returns

`value is MeterRef<string, MeterAggregation, string, Readonly<Record<string, MeterDimension>>, MeterBillingIntent>`

## Description

`defineMeter` preserves literal meter keys, aggregations, billing intent, and declared dimension domains.
The returned branded `MeterRef` can be passed to `MeteringService.record`.
