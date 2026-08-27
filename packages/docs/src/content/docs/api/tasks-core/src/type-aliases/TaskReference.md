---
editUrl: false
next: false
prev: false
title: "TaskReference"
---

> **TaskReference**\<`TPayload`, `TResult`, `TName`\> = `object`

Task reference for identifying tasks while preserving the handler contract.

## Type Parameters

### TPayload

`TPayload` = `unknown`

### TResult

`TResult` = `unknown`

### TName

`TName` _extends_ `string` = `string`

## Properties

### \[TASK_REFERENCE_CONTRACT\]?

> `readonly` `optional` **\[TASK_REFERENCE_CONTRACT\]?**: `object`

Type-only task handler contract.

#### payload

> `readonly` **payload**: `TPayload`

#### result

> `readonly` **result**: `TResult`

---

### methodName

> **methodName**: `string`

Method name

---

### name

> **name**: `TName`

Task name

---

### target

> **target**: `object`

Target class constructor
