---
editUrl: false
next: false
prev: false
title: "ProblemResponseOptions"
---

> **ProblemResponseOptions**\<`Code`, `Category`, `Status`\> = `object`

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

### description?

> `readonly` `optional` **description**: `string`

***

### status?

> `readonly` `optional` **status**: `Status`

***

### type?

> `readonly` `optional` **type**: `string`
