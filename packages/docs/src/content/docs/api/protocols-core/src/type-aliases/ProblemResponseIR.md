---
editUrl: false
next: false
prev: false
title: "ProblemResponseIR"
---

> **ProblemResponseIR**\<`Code`, `Category`, `Status`\> = `object`

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

### cookbookPath?

> `readonly` `optional` **cookbookPath?**: `string`

---

### description?

> `readonly` `optional` **description?**: `string`

---

### routeContractProblems?

> `readonly` `optional` **routeContractProblems?**: readonly `ProblemResponseIR`[]

---

### status

> `readonly` **status**: `Status`

---

### type?

> `readonly` `optional` **type?**: `string`
