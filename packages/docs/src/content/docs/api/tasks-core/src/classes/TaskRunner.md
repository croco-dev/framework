---
editUrl: false
next: false
prev: false
title: "TaskRunner"
---

등록된 태스크를 실행 시스템과 연결해 실행하는 러너입니다.

## Constructors

### Constructor

> **new TaskRunner**(`executionManager`, `registry?`, `logger?`, `runtime?`): `TaskRunner`

#### Parameters

##### executionManager

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/)

##### registry?

[`TaskRegistry`](/api/tasks-core/src/classes/taskregistry/) = `...`

##### logger?

[`ILogger`](/api/framework-context/src/interfaces/ilogger/) = `noopLogger`

##### runtime?

[`TaskRunnerRuntime`](/api/tasks-core/src/interfaces/taskrunnerruntime/) = `{}`

#### Returns

`TaskRunner`

## Methods

### execute()

> **execute**(`taskId`, `payload`, `options?`): `Promise`\<`unknown`\>

#### Parameters

##### taskId

`string`

##### payload

`unknown`

##### options?

[`TaskExecutionOptions`](/api/tasks-core/src/type-aliases/taskexecutionoptions/) = `{}`

#### Returns

`Promise`\<`unknown`\>

---

### retry()

> **retry**(`executionId`): `Promise`\<`unknown`\>

#### Parameters

##### executionId

`string`

#### Returns

`Promise`\<`unknown`\>
