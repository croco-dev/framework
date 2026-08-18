---
editUrl: false
next: false
prev: false
title: "CreateExecutionRecordParams"
---

Store input produced by ExecutionManager after request fingerprinting and legacy-key lookup.

## Extends

- `Omit`\<[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/), `"legacyIdempotencyKeys"`\>

## Properties

### idempotencyKey?

> `optional` **idempotencyKey?**: `string`

Optional idempotency key for deduplication

#### Inherited from

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/).[`idempotencyKey`](/api/execution-core/src/interfaces/createexecutionparams/#idempotencykey)

***

### logs?

> `optional` **logs?**: [`ExecutionLogEntry`](/api/execution-core/src/interfaces/executionlogentry/)[]

Initial log entries

#### Inherited from

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/).[`logs`](/api/execution-core/src/interfaces/createexecutionparams/#logs)

***

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Maximum retry attempts (default: 1)

#### Inherited from

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/).[`maxAttempts`](/api/execution-core/src/interfaces/createexecutionparams/#maxattempts)

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

Optional metadata

#### Inherited from

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/).[`metadata`](/api/execution-core/src/interfaces/createexecutionparams/#metadata)

***

### parentId?

> `optional` **parentId?**: `string`

Optional parent execution ID for nested executions

#### Inherited from

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/).[`parentId`](/api/execution-core/src/interfaces/createexecutionparams/#parentid)

***

### payload?

> `optional` **payload?**: `unknown`

Optional payload data

#### Inherited from

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/).[`payload`](/api/execution-core/src/interfaces/createexecutionparams/#payload)

***

### replayOf?

> `optional` **replayOf?**: `string`

Optional original execution ID when this execution is a replay

#### Inherited from

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/).[`replayOf`](/api/execution-core/src/interfaces/createexecutionparams/#replayof)

***

### requestFingerprint?

> `optional` **requestFingerprint?**: `string`

Required and persisted when idempotencyKey is present.

***

### scheduledFor?

> `optional` **scheduledFor?**: `Date`

Optional scheduled start time

#### Inherited from

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/).[`scheduledFor`](/api/execution-core/src/interfaces/createexecutionparams/#scheduledfor)

***

### timeout?

> `optional` **timeout?**: `number`

Timeout in milliseconds (default: no timeout)

#### Inherited from

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/).[`timeout`](/api/execution-core/src/interfaces/createexecutionparams/#timeout)

***

### type

> **type**: `string`

Execution type: 'task' | 'batch' | 'workflow'

#### Inherited from

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/).[`type`](/api/execution-core/src/interfaces/createexecutionparams/#type)
