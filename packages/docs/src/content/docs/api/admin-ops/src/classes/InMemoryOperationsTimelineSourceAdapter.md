---
editUrl: false
next: false
prev: false
title: "InMemoryOperationsTimelineSourceAdapter"
---

## Implements

- [`OperationsTimelineSourceAdapter`](/api/admin-ops/src/interfaces/operationstimelinesourceadapter/)

## Constructors

### Constructor

> **new InMemoryOperationsTimelineSourceAdapter**(`source`, `events`): `InMemoryOperationsTimelineSourceAdapter`

#### Parameters

##### source

[`OperationsTimelineSource`](/api/admin-ops/src/type-aliases/operationstimelinesource/)

##### events

readonly [`OperationsTimelineEvent`](/api/admin-ops/src/type-aliases/operationstimelineevent/)[]

#### Returns

`InMemoryOperationsTimelineSourceAdapter`

## Properties

### source

> `readonly` **source**: [`OperationsTimelineSource`](/api/admin-ops/src/type-aliases/operationstimelinesource/)

#### Implementation of

[`OperationsTimelineSourceAdapter`](/api/admin-ops/src/interfaces/operationstimelinesourceadapter/).[`source`](/api/admin-ops/src/interfaces/operationstimelinesourceadapter/#source)

## Methods

### collect()

> **collect**(`query?`): `Promise`\<readonly [`OperationsTimelineEvent`](/api/admin-ops/src/type-aliases/operationstimelineevent/)[]\>

#### Parameters

##### query?

[`OperationsTimelineQuery`](/api/admin-ops/src/type-aliases/operationstimelinequery/) = `{}`

#### Returns

`Promise`\<readonly [`OperationsTimelineEvent`](/api/admin-ops/src/type-aliases/operationstimelineevent/)[]\>

#### Implementation of

[`OperationsTimelineSourceAdapter`](/api/admin-ops/src/interfaces/operationstimelinesourceadapter/).[`collect`](/api/admin-ops/src/interfaces/operationstimelinesourceadapter/#collect)
