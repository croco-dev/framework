---
editUrl: false
next: false
prev: false
title: "TestRuntime"
---

## Constructors

### Constructor

> **new TestRuntime**(`options?`): `TestRuntime`

#### Parameters

##### options?

[`TestRuntimeOptions`](/api/testing/src/type-aliases/testruntimeoptions/) = `{}`

#### Returns

`TestRuntime`

## Properties

### clock

> `readonly` **clock**: [`TestClock`](/api/testing/src/classes/testclock/)

***

### environment

> `readonly` **environment**: [`TestEnvironment`](/api/testing/src/classes/testenvironment/)

***

### ids

> `readonly` **ids**: [`TestIdSource`](/api/testing/src/classes/testidsource/)

***

### network

> `readonly` **network**: [`TestNetwork`](/api/testing/src/classes/testnetwork/)

***

### random

> `readonly` **random**: [`TestRandomSource`](/api/testing/src/classes/testrandomsource/)

***

### scenarioId

> `readonly` **scenarioId**: `string`

## Accessors

### replay

#### Get Signature

> **get** **replay**(): [`TestReplayMetadata`](/api/testing/src/type-aliases/testreplaymetadata/)

##### Returns

[`TestReplayMetadata`](/api/testing/src/type-aliases/testreplaymetadata/)

***

### retry

#### Get Signature

> **get** **retry**(): [`TestRetryDependencies`](/api/testing/src/type-aliases/testretrydependencies/)

##### Returns

[`TestRetryDependencies`](/api/testing/src/type-aliases/testretrydependencies/)
