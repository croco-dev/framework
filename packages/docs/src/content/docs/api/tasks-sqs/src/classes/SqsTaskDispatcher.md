---
editUrl: false
next: false
prev: false
title: "SqsTaskDispatcher"
---

Publishes versioned task envelopes using the AWS SDK credential chain and native retry policy.

## Implements

- [`TaskDispatcher`](/api/tasks-core/src/interfaces/taskdispatcher/)

## Constructors

### Constructor

> **new SqsTaskDispatcher**(`options`): `SqsTaskDispatcher`

#### Parameters

##### options

[`SqsTaskDispatcherOptions`](/api/tasks-sqs/src/type-aliases/sqstaskdispatcheroptions/)

#### Returns

`SqsTaskDispatcher`

## Methods

### dispose()

> **dispose**(): `void`

#### Returns

`void`

---

### execute()

> **execute**(`task`, `payload`, `options?`): `Promise`\<[`TaskDispatchResult`](/api/tasks-core/src/type-aliases/taskdispatchresult/)\>

#### Parameters

##### task

`string` \| [`TaskReference`](/api/tasks-core/src/type-aliases/taskreference/)

##### payload

`unknown`

##### options?

[`SqsTaskDispatchOptions`](/api/tasks-sqs/src/type-aliases/sqstaskdispatchoptions/) = `{}`

#### Returns

`Promise`\<[`TaskDispatchResult`](/api/tasks-core/src/type-aliases/taskdispatchresult/)\>

#### Implementation of

[`TaskDispatcher`](/api/tasks-core/src/interfaces/taskdispatcher/).[`execute`](/api/tasks-core/src/interfaces/taskdispatcher/#execute)
