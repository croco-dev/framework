---
editUrl: false
next: false
prev: false
title: "prepareExecutionCheckpoint"
---

> **prepareExecutionCheckpoint**(`key`, `value`): [`PreparedExecutionCheckpoint`](/api/execution-core/src/type-aliases/preparedexecutioncheckpoint/)

Applies the checkpoint persistence boundary shared by in-memory and durable stores.

Values accepted by JSON are normalized to their persisted representation. Values that JSON
cannot represent as the requested property, including undefined, bigint, and cyclic objects,
fail with the stable checkpoint conformance Problem.

## Parameters

### key

`string`

### value

`unknown`

## Returns

[`PreparedExecutionCheckpoint`](/api/execution-core/src/type-aliases/preparedexecutioncheckpoint/)
