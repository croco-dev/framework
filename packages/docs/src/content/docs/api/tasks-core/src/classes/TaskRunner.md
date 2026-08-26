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

#### Call Signature

> **execute**\<`TReference`\>(`reference`, `payload`, `options?`): `Promise`\<[`TaskReferenceResult`](/api/tasks-core/src/type-aliases/taskreferenceresult/)\<`TReference`\>\>

##### Type Parameters

###### TReference

`TReference` _extends_ [`TaskReference`](/api/tasks-core/src/type-aliases/taskreference/)

##### Parameters

###### reference

`TReference`

###### payload

[`TaskReferencePayload`](/api/tasks-core/src/type-aliases/taskreferencepayload/)\<`TReference`\>

###### options?

[`TaskExecutionOptions`](/api/tasks-core/src/type-aliases/taskexecutionoptions/)

##### Returns

`Promise`\<[`TaskReferenceResult`](/api/tasks-core/src/type-aliases/taskreferenceresult/)\<`TReference`\>\>

#### Call Signature

> **execute**(`taskId`, `payload`, `options?`): `Promise`\<`unknown`\>

##### Parameters

###### taskId

`string`

###### payload

`unknown`

###### options?

[`TaskExecutionOptions`](/api/tasks-core/src/type-aliases/taskexecutionoptions/)

##### Returns

`Promise`\<`unknown`\>

---

### executeTracked()

> **executeTracked**(`taskId`, `payload`, `options?`): `Promise`\<`Readonly`\<\{ `executionId`: `string`; `result`: `unknown`; \}\>\>

#### Parameters

##### taskId

`string`

##### payload

`unknown`

##### options?

[`TaskExecutionOptions`](/api/tasks-core/src/type-aliases/taskexecutionoptions/) = `{}`

#### Returns

`Promise`\<`Readonly`\<\{ `executionId`: `string`; `result`: `unknown`; \}\>\>

---

### recoverTimeout()

> **recoverTimeout**(`executionId`, `reason`): `Promise`\<`unknown`\>

Records operator recovery for an indeterminate timeout and retries the execution.

The reason is retained as audit metadata. Inspect external effects first, then call this method;
retry() remains blocked until the attempt-fenced recovery record has been committed.

#### Parameters

##### executionId

`string`

##### reason

`string`

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
