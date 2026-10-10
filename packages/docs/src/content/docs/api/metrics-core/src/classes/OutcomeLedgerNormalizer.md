---
editUrl: false
next: false
prev: false
title: "OutcomeLedgerNormalizer"
---

## Constructors

### Constructor

> **new OutcomeLedgerNormalizer**(): `OutcomeLedgerNormalizer`

#### Returns

`OutcomeLedgerNormalizer`

## Methods

### normalize()

> **normalize**(`events`, `options`): `object`

#### Parameters

##### events

readonly [`MoneyEvent`](/api/metrics-core/src/type-aliases/moneyevent/)[]

##### options

###### cutoff

[`OutcomeCutoff`](/api/metrics-core/src/type-aliases/outcomecutoff/)

###### maxEvents?

`number`

###### scope

[`OutcomeScope`](/api/metrics-core/src/type-aliases/outcomescope/)

#### Returns

`object`

##### counts

> **counts**: `object`

###### counts.duplicates

> **duplicates**: `number`

###### counts.excludedByCutoff

> **excludedByCutoff**: `number`

###### counts.received

> **received**: `number`

###### counts.superseded

> **superseded**: `number`

##### events

> **events**: [`MoneyEvent`](/api/metrics-core/src/type-aliases/moneyevent/)[]
