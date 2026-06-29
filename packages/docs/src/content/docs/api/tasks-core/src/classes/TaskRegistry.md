---
editUrl: false
next: false
prev: false
title: "TaskRegistry"
---

태스크 메타데이터를 수집하고 조회하는 전역 레지스트리입니다.

## Constructors

### Constructor

> **new TaskRegistry**(`tasks?`): `TaskRegistry`

#### Parameters

##### tasks?

`Iterable`\<[`RegisteredTask`](/api/tasks-core/src/type-aliases/registeredtask/), `any`, `any`\>

#### Returns

`TaskRegistry`

## Methods

### collectFromMetadata()

> **collectFromMetadata**(`metadata?`): `void`

#### Parameters

##### metadata?

[`TaskMetadata`](/api/tasks-core/src/type-aliases/taskmetadata/)[] = `...`

#### Returns

`void`

***

### get()

> **get**(`name`): [`RegisteredTask`](/api/tasks-core/src/type-aliases/registeredtask/) \| `undefined`

#### Parameters

##### name

`string`

#### Returns

[`RegisteredTask`](/api/tasks-core/src/type-aliases/registeredtask/) \| `undefined`

***

### getAll()

> **getAll**(): [`RegisteredTask`](/api/tasks-core/src/type-aliases/registeredtask/)[]

#### Returns

[`RegisteredTask`](/api/tasks-core/src/type-aliases/registeredtask/)[]

***

### has()

> **has**(`name`): `boolean`

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### register()

> **register**(`name`, `target`, `methodName`, `metadata`): `void`

#### Parameters

##### name

`string`

##### target

`object`

##### methodName

`string`

##### metadata

[`TaskMetadata`](/api/tasks-core/src/type-aliases/taskmetadata/)

#### Returns

`void`

***

### reset()

> **reset**(): `void`

#### Returns

`void`

***

### fromMetadata()

> `static` **fromMetadata**(`metadata?`): `TaskRegistry`

#### Parameters

##### metadata?

[`TaskMetadata`](/api/tasks-core/src/type-aliases/taskmetadata/)[] = `...`

#### Returns

`TaskRegistry`

***

### getInstance()

> `static` **getInstance**(): `TaskRegistry`

#### Returns

`TaskRegistry`
