---
editUrl: false
next: false
prev: false
title: "ExecutionProblems"
---

Factory methods for creating ExecutionProblem instances.

## Constructors

### Constructor

> **new ExecutionProblems**(): `ExecutionProblems`

#### Returns

`ExecutionProblems`

## Methods

### conflict()

> `static` **conflict**(`detail`): [`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)

#### Parameters

##### detail

`string`

#### Returns

[`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)

---

### continuationConflict()

> `static` **continuationConflict**(`detail`, `evidence?`): [`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)

#### Parameters

##### detail

`string`

##### evidence?

[`ExecutionContinuationConflictEvidence`](/api/execution-core/src/interfaces/executioncontinuationconflictevidence/)

#### Returns

[`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)

---

### continuationUnsupported()

> `static` **continuationUnsupported**(`detail`): [`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)

#### Parameters

##### detail

`string`

#### Returns

[`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)

---

### invalidContinuationLeaseDuration()

> `static` **invalidContinuationLeaseDuration**(`options`): [`InvalidContinuationLeaseDurationProblem`](/api/execution-core/src/classes/invalidcontinuationleasedurationproblem/)

#### Parameters

##### options

[`InvalidContinuationLeaseDurationProblemOptions`](/api/execution-core/src/type-aliases/invalidcontinuationleasedurationproblemoptions/)

#### Returns

[`InvalidContinuationLeaseDurationProblem`](/api/execution-core/src/classes/invalidcontinuationleasedurationproblem/)

---

### invalidStateTransition()

> `static` **invalidStateTransition**(`detail`): [`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)

#### Parameters

##### detail

`string`

#### Returns

[`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)

---

### maxRetriesExceeded()

> `static` **maxRetriesExceeded**(`detail`): [`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)

#### Parameters

##### detail

`string`

#### Returns

[`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)

---

### notFound()

> `static` **notFound**(`detail`): [`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)

#### Parameters

##### detail

`string`

#### Returns

[`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)
