---
editUrl: false
next: false
prev: false
title: "LoadRestControllerSourcesOptions"
---

> **LoadRestControllerSourcesOptions** = `object`

## Properties

### beforeEmit?

> `readonly` `optional` **beforeEmit?**: (`sourceFilePaths`) => `Promise`\<`void`\>

#### Parameters

##### sourceFilePaths

readonly `string`[]

#### Returns

`Promise`\<`void`\>

---

### controllers

> `readonly` **controllers**: `string` \| readonly `string`[]

---

### problems

> `readonly` **problems**: [`RestControllerSourceProblems`](/api/protocol-codegen/src/type-aliases/restcontrollersourceproblems/)

---

### tsconfigPath?

> `readonly` `optional` **tsconfigPath?**: `string`
