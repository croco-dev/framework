---
editUrl: false
next: false
prev: false
title: "defineRouteProblem"
---

> **defineRouteProblem**\<`TProblem`, `Code`, `Category`\>(`problem`, `declaration`): [`RouteProblemDeclaration`](/api/protocols-rest/src/type-aliases/routeproblemdeclaration/)\<`TProblem`, `Code`, `Category`, [`RouteProblemStatus`](/api/protocols-rest/src/type-aliases/routeproblemstatus/)\<`Category`\>\>

## Type Parameters

### TProblem

`TProblem` _extends_ [`Problem`](/api/problems-core/src/classes/problem/)

### Code

`Code` _extends_ `string`

### Category

`Category` _extends_ [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

## Parameters

### problem

[`ProblemConstructor`](/api/protocols-rest/src/type-aliases/problemconstructor/)\<`TProblem`\>

### declaration

#### category

`Category`

#### code

`Code`

#### description?

`string`

#### type?

`string`

## Returns

[`RouteProblemDeclaration`](/api/protocols-rest/src/type-aliases/routeproblemdeclaration/)\<`TProblem`, `Code`, `Category`, [`RouteProblemStatus`](/api/protocols-rest/src/type-aliases/routeproblemstatus/)\<`Category`\>\>
