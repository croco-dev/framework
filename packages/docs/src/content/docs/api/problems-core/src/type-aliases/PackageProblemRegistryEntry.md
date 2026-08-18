---
editUrl: false
next: false
prev: false
title: "PackageProblemRegistryEntry"
---

> **PackageProblemRegistryEntry**\<`Code`, `Category`, `Status`\> = `object`

## Type Parameters

### Code

`Code` _extends_ `string` = `string`

### Category

`Category` _extends_ [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/) = [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

### Status

`Status` _extends_ `number` = `number`

## Properties

### category

> `readonly` **category**: `Category`

---

### code

> `readonly` **code**: `Code`

---

### cookbookPath

> `readonly` **cookbookPath**: `string`

---

### description?

> `readonly` `optional` **description?**: `string`

---

### package

> `readonly` **package**: `string`

---

### public

> `readonly` **public**: `boolean`

---

### redaction

> `readonly` **redaction**: [`ProblemRegistryRedaction`](/api/problems-core/src/type-aliases/problemregistryredaction/)

---

### retryability

> `readonly` **retryability**: `"retryable"` \| `"not-retryable"`

---

### retryable

> `readonly` **retryable**: `boolean`

---

### status

> `readonly` **status**: `Status`

---

### statusPolicy?

> `readonly` `optional` **statusPolicy?**: [`ProblemStatusPolicy`](/api/problems-core/src/type-aliases/problemstatuspolicy/)

---

### type?

> `readonly` `optional` **type?**: `string`

---

### visibility

> `readonly` **visibility**: [`ProblemRegistryVisibility`](/api/problems-core/src/type-aliases/problemregistryvisibility/)
