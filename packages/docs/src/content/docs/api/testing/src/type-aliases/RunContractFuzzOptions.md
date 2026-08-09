---
editUrl: false
next: false
prev: false
title: "RunContractFuzzOptions"
---

> **RunContractFuzzOptions** = `object` & [`ContractReplayOptions`](/api/testing/src/type-aliases/contractreplayoptions/)

## Type Declaration

### arbitrary?

> `readonly` `optional` **arbitrary?**: `fc.Arbitrary`\<[`ContractGeneratedCase`](/api/testing/src/type-aliases/contractgeneratedcase/)\>

### execute

> `readonly` **execute**: [`ContractExecutor`](/api/testing/src/type-aliases/contractexecutor/)

### failureDirectory?

> `readonly` `optional` **failureDirectory?**: `string`

### failureSink?

> `readonly` `optional` **failureSink?**: [`ContractFailureSink`](/api/testing/src/interfaces/contractfailuresink/)

### numRuns?

> `readonly` `optional` **numRuns?**: `number`

### profile?

> `readonly` `optional` **profile?**: [`ContractTestProfile`](/api/testing/src/type-aliases/contracttestprofile/)

### replayCommand?

> `readonly` `optional` **replayCommand?**: `string`

### route

> `readonly` **route**: [`ContractGraphRoute`](/api/protocols-core/src/type-aliases/contractgraphroute/)

### runtime

> `readonly` **runtime**: `string`
