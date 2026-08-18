---
editUrl: false
next: false
prev: false
title: "ProblemRegistryProblemDefinition"
---

> **ProblemRegistryProblemDefinition**\<`Category`, `Status`\> = `object`

## Type Parameters

### Category

`Category` _extends_ [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/) = [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

### Status

`Status` _extends_ `number` = `number`

## Properties

### category

> `readonly` **category**: `Category`

---

### cookbookPath?

> `readonly` `optional` **cookbookPath?**: `string`

---

### description?

> `readonly` `optional` **description?**: `string`

---

### public

> `readonly` **public**: `boolean`

---

### redaction

> `readonly` **redaction**: [`ProblemRegistryRedaction`](/api/problems-core/src/type-aliases/problemregistryredaction/)

---

### retryable

> `readonly` **retryable**: `boolean`

---

### status?

> `readonly` `optional` **status?**: `Status`

---

### statusPolicy?

> `readonly` `optional` **statusPolicy?**: [`ProblemStatusPolicy`](/api/problems-core/src/type-aliases/problemstatuspolicy/)

---

### type?

> `readonly` `optional` **type?**: `string`
