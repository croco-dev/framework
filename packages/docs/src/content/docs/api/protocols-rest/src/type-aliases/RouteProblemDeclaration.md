---
editUrl: false
next: false
prev: false
title: "RouteProblemDeclaration"
---

> **RouteProblemDeclaration**\<`TProblem`, `Code`, `Category`, `Status`\> = `object`

## Type Parameters

### TProblem

`TProblem` _extends_ [`Problem`](/api/problems-core/src/classes/problem/) = [`Problem`](/api/problems-core/src/classes/problem/)

### Code

`Code` _extends_ `string` = `RouteProblemCode`\<`TProblem`\>

### Category

`Category` _extends_ [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/) = `RouteProblemCategory`\<`TProblem`\>

### Status

`Status` _extends_ `number` = [`RouteProblemStatus`](/api/protocols-rest/src/type-aliases/routeproblemstatus/)\<`Category`\>

## Properties

### category

> `readonly` **category**: `Category`

---

### code

> `readonly` **code**: `Code`

---

### description?

> `readonly` `optional` **description?**: `string`

---

### problem

> `readonly` **problem**: [`ProblemConstructor`](/api/protocols-rest/src/type-aliases/problemconstructor/)\<`TProblem`\>

---

### status

> `readonly` **status**: `Status`

---

### type?

> `readonly` `optional` **type?**: `string`
