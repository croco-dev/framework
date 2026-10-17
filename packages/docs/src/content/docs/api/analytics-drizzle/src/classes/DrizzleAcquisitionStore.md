---
editUrl: false
next: false
prev: false
title: "DrizzleAcquisitionStore"
---

PostgreSQL scope lock serializes receipts, identity links, definitions and erasure.
This bounded store supports at most 10,000 records per scope; overflow fails explicitly.
Large installations should shard application scopes or implement the same store contract.

## Implements

- `AcquisitionStore`

## Constructors

### Constructor

> **new DrizzleAcquisitionStore**(`db`): `DrizzleAcquisitionStore`

#### Parameters

##### db

[`FactHistoryDatabase`](/api/analytics-drizzle/src/interfaces/facthistorydatabase/)

#### Returns

`DrizzleAcquisitionStore`

## Methods

### transact()

> **transact**\<`T`\>(`scope`, `operation`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### scope

`FactScope`

##### operation

(`state`) => `T`

#### Returns

`Promise`\<`T`\>

#### Implementation of

`AcquisitionStore.transact`
