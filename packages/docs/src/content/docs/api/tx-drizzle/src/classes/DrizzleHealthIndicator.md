---
editUrl: false
next: false
prev: false
title: "DrizzleHealthIndicator"
---

## Implements

- `HealthIndicator`

## Constructors

### Constructor

> **new DrizzleHealthIndicator**(`db`, `options?`): `DrizzleHealthIndicator`

#### Parameters

##### db

[`DrizzleDb`](/api/tx-drizzle/src/interfaces/drizzledb/)

##### options?

[`DrizzleHealthIndicatorOptions`](/api/tx-drizzle/src/type-aliases/drizzlehealthindicatoroptions/) = `{}`

#### Returns

`DrizzleHealthIndicator`

## Methods

### check()

> **check**(): `Promise`\<`HealthIndicatorResult`\>

#### Returns

`Promise`\<`HealthIndicatorResult`\>

#### Implementation of

`HealthIndicator.check`
