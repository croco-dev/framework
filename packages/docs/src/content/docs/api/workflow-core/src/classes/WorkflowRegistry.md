---
editUrl: false
next: false
prev: false
title: "WorkflowRegistry"
---

## Constructors

### Constructor

> **new WorkflowRegistry**(`workflows?`, `taskRegistry?`): `WorkflowRegistry`

#### Parameters

##### workflows?

`Iterable`\<[`WorkflowDefinition`](/api/workflow-core/src/type-aliases/workflowdefinition/), `any`, `any`\>

##### taskRegistry?

[`TaskRegistry`](/api/tasks-core/src/classes/taskregistry/) = `...`

#### Returns

`WorkflowRegistry`

## Properties

### taskRegistry

> `readonly` **taskRegistry**: [`TaskRegistry`](/api/tasks-core/src/classes/taskregistry/)

## Methods

### get()

> **get**(`name`): [`WorkflowDefinition`](/api/workflow-core/src/type-aliases/workflowdefinition/) \| `undefined`

#### Parameters

##### name

`string`

#### Returns

[`WorkflowDefinition`](/api/workflow-core/src/type-aliases/workflowdefinition/) \| `undefined`

---

### getAll()

> **getAll**(): [`WorkflowDefinition`](/api/workflow-core/src/type-aliases/workflowdefinition/)[]

#### Returns

[`WorkflowDefinition`](/api/workflow-core/src/type-aliases/workflowdefinition/)[]

---

### getByReference()

> **getByReference**(`reference`): [`WorkflowDefinition`](/api/workflow-core/src/type-aliases/workflowdefinition/) \| `undefined`

#### Parameters

##### reference

[`TypedWorkflowReference`](/api/workflow-core/src/type-aliases/typedworkflowreference/)\<`unknown`, readonly [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)[]\>

#### Returns

[`WorkflowDefinition`](/api/workflow-core/src/type-aliases/workflowdefinition/) \| `undefined`

---

### has()

> **has**(`name`): `boolean`

#### Parameters

##### name

`string`

#### Returns

`boolean`

---

### register()

> **register**(`workflow`): `void`

#### Parameters

##### workflow

[`WorkflowDefinition`](/api/workflow-core/src/type-aliases/workflowdefinition/)

#### Returns

`void`

---

### fromMetadata()

> `static` **fromMetadata**(`options?`): `WorkflowRegistry`

#### Parameters

##### options?

`WorkflowRegistryOptions` = `{}`

#### Returns

`WorkflowRegistry`
