---
editUrl: false
next: false
prev: false
title: "ProblemResponseIR"
---

> **ProblemResponseIR**\<`Code`, `Category`, `Status`\> = `object`

## Type Parameters

### Code

`Code` *extends* `string` = `string`

### Category

`Category` *extends* [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/) = [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

### Status

`Status` *extends* `number` = `number`

## Properties

### category

> `readonly` **category**: `Category`

***

### code

> `readonly` **code**: `Code`

***

### cookbookPath?

> `readonly` `optional` **cookbookPath?**: `string`

***

### description?

> `readonly` `optional` **description?**: `string`

***

### registry?

> `readonly` `optional` **registry?**: [`ProblemRegistryReferenceIR`](/api/protocols-core/src/type-aliases/problemregistryreferenceir/)

***

### routeContractProblems?

> `readonly` `optional` **routeContractProblems?**: readonly `ProblemResponseIR`[]

***

### status

> `readonly` **status**: `Status`

***

### type?

> `readonly` `optional` **type?**: `string`
