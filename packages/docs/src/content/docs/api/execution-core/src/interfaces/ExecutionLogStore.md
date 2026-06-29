---
editUrl: false
next: false
prev: false
title: "ExecutionLogStore"
---

Optional store capability for atomic execution log append.

Stores that support recordLog should implement this with an atomic append operation,
not a read-modify-write replacement of the full logs array.

## Methods

### appendLog()

> **appendLog**(`id`, `entry`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### id

`string`

##### entry

[`ExecutionLogEntry`](/api/execution-core/src/interfaces/executionlogentry/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>
